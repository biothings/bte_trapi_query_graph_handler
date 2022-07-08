const axios = require('axios');
const { toPairs } = require('lodash');
const debug = require('debug')('bte:biothings-explorer-trapi:pfocr');
const { intersection } = require('../utils');


// the minimum acceptable intersection size between the CURIEs
// in a TRAPI result and in a PFOCR figure.
const MATCH_COUNT_MIN = 2;

/* Get all results by using a scrolling query
 * https://docs.mygene.info/en/latest/doc/query_service.html#scrolling-queries
 * The initial queryString must include "fetch_all=TRUE". Any subsequent
 * scrolling requests will include the scroll_id in the queryString.
 */
async function getAllByScrolling(baseUrl, queryString, batchIndex, hits=[]) {
  const {data} = await axios.get(baseUrl + '?' + queryString)
    .catch(err => {
      debug('Error in scrolling request', err);
      throw err;
    });

  hits.push(...data.hits);
  debug(`Batch ${batchIndex}: ${hits.length} / ${data.total} hits retrieved for PFOCR figure data`);
  if (hits.length < data.total) {
    return await getAllByScrolling(baseUrl, `scroll_id=${data._scroll_id}`, batchIndex, hits);
  } else {
    return hits;
  }
}

/* qTerms are the CURIEs that go with the 'q' query parameter.
 */
async function getPfocrFigures(qTerms) {
  debug(`Getting PFOCR figure data`);
  const url = 'https://biothings.ncats.io/pfocr/query';
  /* At present, we need to use GET. There is a limit on the supported length of
   * the query string, so if the number of CURIEs in our query pushes us over
   * that limit, we need to split it up into batches.
   * TODO: once POST queries are supported, we can simplify this code by
   * submitting all the CURIEs in one request.
   */
  const queryStringLengthLimit = 4000;
  const queryStrings = [];
  const concatenator = ' OR ';
  let currentQueryString = 'fetch_all=true&q=' + qTerms.pop();
  for (const qTerm of qTerms) {
    if ((currentQueryString + concatenator + qTerm).length < queryStringLengthLimit) {
      currentQueryString += concatenator + qTerm;
    } else {
      queryStrings.push(currentQueryString)
      currentQueryString = 'fetch_all=true&q=' + qTerm
    }
  }
  queryStrings.push(currentQueryString);
  const docMessage = `Making ${queryStrings.length} scrolling request(s) for PFOCR figure data`;
  if (queryStrings.length === 1) {
    debug(docMessage);
  } else {
    debug(`${docMessage} (multiple required due to query string length limit for GET requests)`);
  }

  const figureResultsBatches = await Promise.all(
    queryStrings.map((queryString, batchIndex) => {
      return getAllByScrolling(url, queryString, batchIndex);
    })
  )
    .catch(err => {
      debug('Error getting PFOCR figures (getPfocrFigures)', err);
      throw err;
    });

  /* We need to merge the batches resulting from the query string limit.
   * When we make separate queries for different CURIEs, we can get
   * duplicate figures, so we also need to de-duplicate.
   */
  const mergedFigureResults = [];
  const figuresAdded = new Set();
  for (const resultsBatch of figureResultsBatches) {
    for (const result of resultsBatch) {
      const figureId = result._id;
      if (!figuresAdded.has(figureId)) {
        figuresAdded.add(figureId)
        mergedFigureResults.push(result);
      }
    }
  }
  debug(`${mergedFigureResults.length} total PFOCR figure hits retrieved`);
  return mergedFigureResults;
}

function getMatchableQNodeIDs(allTrapiResults) {
  let matchableQNodeIDs = [];
  if (allTrapiResults.length > 0) {
    // TODO: this will need to be updated to handle non-NCBIGene CURIEs as well
    // as non-gene CURIEs once we support querying for chemicals and diseases.

    // We're just looking at the first node binding for each query node to see
    // whether it has a CURIE that start with 'NCBIGene:'
    matchableQNodeIDs = toPairs(allTrapiResults[0].node_bindings)
      .filter(([qNodeID, nodeBindingValues]) => {
        const matchableDatasourceCount = nodeBindingValues
          .filter(nodeBindingValue => nodeBindingValue.id.startsWith('NCBIGene:'))
          .length;

        return matchableDatasourceCount > 0;
      })
      .map(([qNodeID, curies]) => qNodeID);
  }
  debug(`QNode(s) with CURIEs PFOCR could potentially match: ${matchableQNodeIDs}`)
  return matchableQNodeIDs;
}

/* time complexity: O(t*f)
 * where
 * t: trapiResults.length
 * f: figures.length
 */
async function enrichTrapiResultsWithPfocrFigures(allTrapiResults) {
  const matchableQNodeIDs = getMatchableQNodeIDs(allTrapiResults);

  if (matchableQNodeIDs.length < MATCH_COUNT_MIN) {
    // No TRAPI result can satisfy MATCH_COUNT_MIN
    return;
  }

  // TODO: currently just NCBIGene CURIEs. Expand to handle any CURIE in PFOCR.
  const uniqueTrapiCuries = new Set();
  const trapiResultToCurieSet = new Map();
  for (const trapiResult of allTrapiResults) {
    const trapiResultCurieSet = new Set();
    for (const matchableQNodeID of matchableQNodeIDs) {
      trapiResult.node_bindings[matchableQNodeID]
        .map(node_binding => node_binding.id)
        .filter(curie => curie.startsWith('NCBIGene:'))
        .forEach((curie) => {
          trapiResultCurieSet.add(curie);
        });
    }

    trapiResultToCurieSet.set(trapiResult, trapiResultCurieSet);

    if (trapiResultCurieSet.size >= MATCH_COUNT_MIN) {
      for (const trapiResultCurie of trapiResultCurieSet) {
        uniqueTrapiCuries.add(trapiResultCurie);
      }
    }
  }

  const figures = await getPfocrFigures(
    Array.from(uniqueTrapiCuries)
      .filter(curie => curie.startsWith('NCBIGene:'))
      .map(curie => 'associatedWith.mentions.genes.' + curie.toLowerCase())
  )
    .catch(err => {
      debug('Error getting PFOCR figures (enrichTrapiResultsWithPfocrFigures)', err);
      throw err;
    });
  debug(`${figures.length} PFOCR figures match at least one gene from any TRAPI result`)

  const uniqueFigureCuries = new Set();
  const figureToCuries = new Map();
  for (const figure of figures) {
    const figureCuries = figure.associatedWith.mentions.genes.ncbigene
      .map(ncbigeneNumber => 'NCBIGene:' + ncbigeneNumber);

    figureToCuries.set(figure, new Set(figureCuries));

    for (const figureCurie of figureCuries) {
      uniqueFigureCuries.add(figureCurie)
    }
  }

  debug(
    `Finding the PFOCR figures and TRAPI result sets that share ${MATCH_COUNT_MIN}+ CURIEs`
  );
  debug(`${uniqueFigureCuries.size} unique PFOCR figure CURIEs`);
  debug(`${uniqueTrapiCuries.size} unique TRAPI result CURIEs`);

  const matchableCurieSet = intersection(uniqueFigureCuries, uniqueTrapiCuries);
  debug(`${matchableCurieSet.size} CURIEs common to both TRAPI results and PFOCR figures`);

  const matchedFigures = new Set();
  const matchedTrapiResults = new Set();
  for (const trapiResult of allTrapiResults) {
    const trapiResultCurieSet = trapiResultToCurieSet.get(trapiResult);
    if (intersection(trapiResultCurieSet, matchableCurieSet).size < MATCH_COUNT_MIN) {
      continue;
    }

    for (const figure of figures) {
      const figureCurieSet = figureToCuries.get(figure);
      if (intersection(trapiResultCurieSet, figureCurieSet).size < MATCH_COUNT_MIN) {
        continue;
      }

      if (!trapiResult.hasOwnProperty('pfocr')) {
        trapiResult.pfocr = [];
      }

      const matchedQNodes = matchableQNodeIDs.filter(matchableQNodeID => {
        const currentQNodeCurieSet = new Set(
          trapiResult.node_bindings[matchableQNodeID]
          .map(node_binding => node_binding.id)
        );

        return intersection(currentQNodeCurieSet, figureCurieSet).size > 0;
      });

      trapiResult.pfocr.push({
        figureUrl: figure.associatedWith.figureUrl,
        pmc: figure.associatedWith.pmc,
        // TODO: do we want to include figure title?
        //title: figure.associatedWith.title,
        nodes: matchedQNodes,
        // TODO: do we want to include the list of matched CURIEs?
        // TODO: add score
      });

      matchedFigures.add(figure.associatedWith.figureUrl);
      matchedTrapiResults.add(trapiResult);
    }
  }

  // Each of the matched figures has at least one TRAPI result with an overlap of 2+ genes
  debug(
    `${matchedFigures.size} PFOCR figures match ${MATCH_COUNT_MIN}+ genes in individual TRAPI result(s)`
  );
  // Each of the matched TRAPI results has at least one figure with an overlap of 2+ genes
  debug(
    `${matchedTrapiResults.size} TRAPI results match ${MATCH_COUNT_MIN}+ genes in individual PFOCR figures(s)`
  );
}

module.exports.enrichTrapiResultsWithPfocrFigures = enrichTrapiResultsWithPfocrFigures;