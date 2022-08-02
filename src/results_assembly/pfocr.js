const axios = require('axios');
const debug = require('debug')('bte:biothings-explorer-trapi:pfocr');
const fs = require("fs")
const { BloomFilter, ScalableBloomFilter, XorFilter } = require('bloom-filters')
const bloomit = require('bloomit');
const BloomFilterBF = bloomit.BloomFilter;

const { intersection } = require('../utils');


// the minimum acceptable intersection size between the CURIEs
// in a TRAPI result and in a PFOCR figure.
const MATCH_COUNT_MIN = 2;
const FIGURE_COUNT_MAX = 20;

/* Get all results by using a scrolling query
 * https://docs.mygene.info/en/latest/doc/query_service.html#scrolling-queries
 * The initial queryString must include 'fetch_all=TRUE'. Any subsequent
 * scrolling requests will include the scroll_id in the queryString.
 */
async function loadFilter(url='https://www.dropbox.com/s/1f14t5zaseocyg6/bte_chemicals_diseases_genes.ndjson?dl=1') {
  const {data} = await axios.get(url)
    .catch(err => {
      debug('Error getting PFOCR data', err);
      throw err;
    });

  const uniqueFigureCuries = new Set();
  for (const figureStr of data.split('\n')) {
    if (figureStr === '') {
      continue;
    }
    const figure = JSON.parse(figureStr);
    const figureCuries = figure.associatedWith.mentions.genes.ncbigene
      .map(ncbigeneNumber => 'NCBIGene:' + ncbigeneNumber);

    for (const figureCurie of figureCuries) {
      uniqueFigureCuries.add(figureCurie)
    }
  }

  console.log(uniqueFigureCuries.size)

  const pfocrUniqueGeneCount = 14253;

  // number of pairs of CURIEs
  // no repetition
  // sorted always first
  const pfocrUniqueGenePairCount = 101566878;

  const comboCount = pfocrUniqueGeneCount + pfocrUniqueGenePairCount;

  const getCurieCombos = function*() {
    const uniqueFigureCuriesList = Array.from(uniqueFigureCuries).sort();
    const uniqueFigureCuriesListLength = uniqueFigureCuriesList.length;
    let k = 0;
    for (let i = 0; i < uniqueFigureCuriesListLength - 1; i++) {
      const firstCurie = uniqueFigureCuriesList[i];
      //yield firstCurie;
      for (let j = i + 1; j < uniqueFigureCuriesListLength; j++) {
        k += 1;
        if (k % 10000000 === 0) {
          console.log(`k: ${k}`);
        }
        const secondCurie = uniqueFigureCuriesList[j];
        yield [firstCurie, secondCurie].join(' & ');
      }
    }
    console.log(`k: ${k}`);
  };

  const errorRate = 0.1 // 10% error rate
  /*
  const combos = Array.from(getCurieCombos());

  const pfocrFilterCombosXor = new XorFilter(combos.length);
  pfocrFilterCombosXor.add(combos);
  fs.writeFile("pfocrFilterCombosXor.json", JSON.stringify(pfocrFilterCombosXor.saveAsJSON()), err => {
      if (err) {
          console.log(err)
      }
  });

  const pfocrFilterCombosBloom = BloomFilter.create(combos.length, errorRate);
  for (const curieCombo of combos) {
    pfocrFilterCombosBloom.add(curieCombo);
  }

  console.log(pfocrFilterCombosBloom.has('a')) // false
  console.log(pfocrFilterCombosBloom.has('NCBIGene:1')) // true
  console.log(pfocrFilterCombosBloom.has('NCBIGene:1023')) // ?
  console.log(pfocrFilterCombosBloom.has('NCBIGene:5971')) // ?
  console.log(pfocrFilterCombosBloom.has('NCBIGene:1 & NCBIGene:10')) // true
  console.log(pfocrFilterCombosBloom.has('NCBIGene:5118 & NCBIGene:5971')) // ?

  fs.writeFile("pfocrFilterCombosBloom.json", JSON.stringify(pfocrFilterCombosBloom.saveAsJSON()), err => {
      if (err) {
          console.log(err)
      }
  });
  //*/

  //const pfocrFilterCombosBloomBF = BloomFilterBF.from(getCurieCombos(), errorRate);
  const pfocrFilterCombosBloomBF = BloomFilterBF.create(pfocrUniqueGenePairCount, errorRate);
  for (const curieCombo of getCurieCombos()) {
    pfocrFilterCombosBloomBF.add(curieCombo);
  }
  fs.writeFile("pfocrFilterCombosBloomBF.json", pfocrFilterCombosBloomBF.export(), err => {
      if (err) {
          console.log(err)
      }
  });

  //*
  const pfocrFilterSingleBloomBF = BloomFilterBF.create(uniqueFigureCuries.size, 0.01);
  for (curie in uniqueFigureCuries) {
    pfocrFilterSingleBloomBF.add(curie)
  }
  fs.writeFile("pfocrFilterSingleBloomBF.json", pfocrFilterSingleBloomBF.export(), err => {
      if (err) {
          console.log(err)
      }
  });
  //*/

  //*
  const pfocrFilterSingleBloom = BloomFilter.create(uniqueFigureCuries.size, 0.01);
  for (curie in uniqueFigureCuries) {
    pfocrFilterSingleBloom.add(curie)
  }
  fs.writeFile("pfocrFilterSingleBloom.json", JSON.stringify(pfocrFilterSingleBloom.saveAsJSON()), err => {
      if (err) {
          console.log(err)
      }
  });
  //*/

  //*
  const pfocrFilterSingleXor = new XorFilter(uniqueFigureCuries.size)
  pfocrFilterSingleXor.add(Array.from(uniqueFigureCuries))
  fs.writeFile("pfocrFilterSingleXor.json", JSON.stringify(pfocrFilterSingleXor.saveAsJSON()), err => {
      if (err) {
          console.log(err)
      }
  });
  //*/

  //debug(`Batch ${batchIndex}: ${hits.length} / ${data.total} hits retrieved for PFOCR figure data`);
}

loadFilter()

/* Get all results by using a scrolling query
 * https://docs.mygene.info/en/latest/doc/query_service.html#scrolling-queries
 * The initial queryString must include 'fetch_all=TRUE'. Any subsequent
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
  let qTermCount = 0;
  for (const qTerm of qTerms) {
    if ((currentQueryString + concatenator + qTerm).length < queryStringLengthLimit) {
      qTermCount += 1;
      currentQueryString += concatenator + qTerm;
    } else {
      console.log(`qTermCount: ${qTermCount}`)
      qTermCount = 0;
      queryStrings.push(currentQueryString)
      currentQueryString = 'fetch_all=true&q=' + qTerm
    }
  }
  console.log(`qTermCount: ${qTermCount}`)
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
  const matchableQNodeIDs = new Set();

  if (allTrapiResults.length === 0) {
    return matchableQNodeIDs;
  }

  // TODO: this will need to be updated to handle non-NCBIGene CURIEs as well
  // as non-gene CURIEs once we support querying for chemicals and diseases.

  const supportedPrefixes = new Set(['NCBIGene']);
  for (const trapiResult of allTrapiResults) {
    for (const [qNodeID, nodeBindingValues] of Object.entries(trapiResult.node_bindings)) {
      for (const nodeBindingValue of nodeBindingValues) {
        const prefix = nodeBindingValue.id.split(':')[0];
        if (supportedPrefixes.has(prefix)) {
          matchableQNodeIDs.add(qNodeID);
          break;
        }
      }
    }
  }

  debug(`QNode(s) having CURIEs that PFOCR could potentially match: ${Array.from(matchableQNodeIDs)}`)
  return matchableQNodeIDs;
}

/* time complexity: O(t*f)
 * where
 * t: trapiResults.length
 * f: figures.length
 */
async function enrichTrapiResultsWithPfocrFigures(allTrapiResults) {
  const matchableQNodeIDs = getMatchableQNodeIDs(allTrapiResults);

  if (matchableQNodeIDs.size < MATCH_COUNT_MIN) {
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

    if (trapiResultCurieSet.size > MATCH_COUNT_MIN) {
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
      const commonCuries = intersection(trapiResultCurieSet, figureCurieSet);
      if (commonCuries.size < MATCH_COUNT_MIN) {
        continue;
      }

      if (!trapiResult.hasOwnProperty('pfocr')) {
        trapiResult.pfocr = [];
      }

      // TODO: use a smarter way of picking the top 20.
      // Right now it's just the first 20.
      if (trapiResult.pfocr.length >= FIGURE_COUNT_MAX) {
        debug(`Truncating PFOCR figures at ${FIGURE_COUNT_MAX} for TRAPI result w/ ${Array.from(commonCuries)}`)
        break;
      }

      const matchedQNodes = Array.from(matchableQNodeIDs).filter(matchableQNodeID => {
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

  // Each of the matched figures has at least one TRAPI result with an overlap of 2+ genes.
  // Each of the matched TRAPI results has at least one figure with an overlap of 2+ genes.
  debug(
    `${MATCH_COUNT_MIN}+ CURIE matches: ${matchedFigures.size} PFOCR figures and ${matchedTrapiResults.size} TRAPI results`
  );
}

module.exports.enrichTrapiResultsWithPfocrFigures = enrichTrapiResultsWithPfocrFigures;