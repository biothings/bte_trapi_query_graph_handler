const { all } = require('async');
const axios = require('axios');
const debug = require('debug')('bte:biothings-explorer-trapi:pfocr');
const { intersection } = require('../utils');
const { _, merge } = require('lodash');
const { default: Analyze } = require('chi-square-p-value');

// the minimum acceptable intersection size between the CURIEs
// in a TRAPI result and in a PFOCR figure.
const MATCH_COUNT_MIN = 2;
const FIGURE_COUNT_MAX = 20;

/* Get all results by using a scrolling query
 * https://docs.mygene.info/en/latest/doc/query_service.html#scrolling-queries
 * Using new POST scrolling behavior here:
 * https://github.com/newgene/biothings.api/pull/52
 * All queries must include size: 1000, with_total: true
 * Subsequent queries must use `from` to designate a starting point
 */
async function getAllByScrolling(baseUrl, queryBody, batchIndex, hits=[]) {
  queryBody.from = batchIndex;
  const { data } = await axios.post(baseUrl, queryBody)
    .catch(err => {
      debug('Error in scrolling request', err);
      throw err;
    });

  hits.push(...data.hits);
  debug(`Batch window ${batchIndex}-${batchIndex + 1000}: ${data.hits.length} hits retrieved for PFOCR figure data`);
  if (batchIndex + 1000 < data.max_total) {
    return await getAllByScrolling(baseUrl, queryBody, batchIndex + 1000, hits);
  } else {
    return hits;
  }
}

/* qTerms are the CURIEs that go with the 'q' query parameter.
 */
async function getPfocrFigures(qTerms) {
  debug(`Getting PFOCR figure data`);
  const url = 'https://biothings.ncats.io/pfocr/query';
  /*
   * We can now POST using minimum_should_match to bypass most set logic on our side
   * detailed here: https://github.com/biothings/pending.api/issues/88
   */

  const figureResults = []
  await Promise.all(_.chunk(Array.from(qTerms), 1000).map(async (qTermBatch) => {
    const queryBody = {
      q: Array.from(qTermBatch),
      scopes: "associatedWith.mentions.genes.ncbigene", // TODO better system when we use more than NCBIGene
      fields: [
        "_id",
        "associatedWith.mentions.genes.ncbigene",
        "associatedWith.pmc",
        "associatedWith.figureUrl",
      ],
      operator: "OR",
      analyzer: "whitespace",
      minimum_should_match: MATCH_COUNT_MIN,
      size: 1000,
      with_total: true,
    }

    figureResults.push(...(await getAllByScrolling(url, queryBody, 0)));

  })).catch(err => {
    debug('Error getting PFOCR figures (getPfocrFigures)', err);
    throw err;
  });;

  /*
   * When we make separate queries for different CURIEs, we can get
   * duplicate figures, so we need to de-duplicate.
   */
  const mergedFigureResults = {};
  const figuresAdded = new Set();
  figureResults.map((figure) => {
    const figureId = figure._id;
    if (!figure.notfound && !figuresAdded.has(figureId)) {
      figuresAdded.add(figureId)
      mergedFigureResults[figureId] = { ...figure, query: new Set([figure.query]) };
    } else if (!figure.notfound && figuresAdded.has(figureId)) {
      mergedFigureResults[figureId].query.add(figure.query)
    }
  });

  debug(`${Object.values(mergedFigureResults).length} total PFOCR figure hits retrieved`);
  return Object.values(mergedFigureResults);
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

  const trapiResultToCurieSet = new Map();

  const curieCombinations = new Set(allTrapiResults.map((res) => {
    const resultCuries = new Set();
    [...matchableQNodeIDs].forEach((QNodeID) => {
      res.node_bindings[QNodeID]
        .map(node_binding => node_binding.id)
        .filter(curie => curie.startsWith('NCBIGene:'))
        .forEach((curie) => {
          resultCuries.add(curie);
        });
    });

    const resultCuriesString = [...resultCuries].map(curie => curie.replace("NCBIGene:", "")).join(" ");

    if (resultCuries.size >= MATCH_COUNT_MIN) {
      trapiResultToCurieSet.set(res, resultCuriesString);
    }

    return resultCuriesString;
  }).filter(str => str.split(" ").length >= MATCH_COUNT_MIN));

  const figures = await getPfocrFigures(curieCombinations).catch(err => {
    debug('Error getting PFOCR figures (enrichTrapiResultsWithPfocrFigures)', err);
    throw err;
  });;

  debug(`${figures.length} PFOCR figures match at least ${MATCH_COUNT_MIN} genes from any TRAPI result`);

  const figuresByCuries = {};
  figures.forEach((figure) => {
    [...figure.query].forEach((queryCuries) => {
      figuresByCuries[queryCuries] = queryCuries in figuresByCuries
        ? [...figuresByCuries[queryCuries], figure]
        : [figure];
    })
  });

  const matchedFigures = new Set();
  const matchedTrapiResults = new Set();

  const allGenesInAllFigures = figures.reduce((set, fig) => {
    fig.associatedWith.mentions.genes.ncbigene.forEach((gene) => set.add(gene));
    return set;
  }, new Set()).size;

  for (const trapiResult of allTrapiResults) {
    // No figures match this result
    if (!figuresByCuries[trapiResultToCurieSet.get(trapiResult)]) {
      continue
    }

    if (figuresByCuries[trapiResultToCurieSet.get(trapiResult)].length > FIGURE_COUNT_MAX) {
      debug(`Truncating PFOCR figures at ${FIGURE_COUNT_MAX} for TRAPI result w/ ${trapiResultToCurieSet.get(trapiResult)}`)
    }

    const resultCuries = new Set();
      [...matchableQNodeIDs].forEach((QNodeID) => {
        trapiResult.node_bindings[QNodeID].map((node_binding) => node_binding.id)
          .filter((curie) => curie.startsWith('NCBIGene:'))
          .forEach((curie) => {
            resultCuries.add(curie.replace('NCBIGene:', ''));
          });
      });

    const resultGenesInAllFigures = figures.filter((fig) => {
      return fig.associatedWith.mentions.genes.ncbigene.some((gene) => resultCuries.has(gene));
    }).length;

    figuresByCuries[trapiResultToCurieSet.get(trapiResult)].forEach((figure) => {
      if (!trapiResult.hasOwnProperty('pfocr')) {
        trapiResult.pfocr = [];
      }
      const matchedQNodes = [...matchableQNodeIDs].filter(matchableQNodeID => {
        const currentQNodeCurieSet = new Set(
          trapiResult.node_bindings[matchableQNodeID]
          .map(node_binding => node_binding.id)
        );

        return (
          intersection(
            currentQNodeCurieSet,
            new Set(
              [...figure.query].reduce((arr, queryCuries) => {
                return [...arr, ...queryCuries.split(' ').map((curie) => `NCBIGene:${curie}`)];
              }, []),
            ),
          ).size > 0
        );
      });

      const figureCurieSet = new Set(figure.associatedWith.mentions.genes.ncbigene)

      const resultGenesInFigure = intersection(
        resultCuries,
        figureCurieSet,
      ).size;

      const otherGenesInFigure = figureCurieSet.size - resultGenesInFigure;

      let resultGenesInOtherFigures = resultGenesInAllFigures - resultGenesInFigure;
      let otherGenesInOtherFigures = allGenesInAllFigures - resultGenesInOtherFigures;


      trapiResult.pfocr.push({
        figureUrl: figure.associatedWith.figureUrl,
        pmc: figure.associatedWith.pmc,
        // TODO: do we want to include figure title? Note: this would need to be added to queryBody.
        //title: figure.associatedWith.title,
        nodes: matchedQNodes,
        // TODO: do we want to include the list of matched CURIEs?
        // TODO: add score
        score: 1 - parseFloat(Analyze([
          [resultGenesInFigure, resultGenesInOtherFigures],
          [otherGenesInFigure, otherGenesInOtherFigures],
        ]).pValue)
      });
      matchedFigures.add(figure);
      matchedTrapiResults.add(trapiResult);
    });

    // Sort by score and cut down to top 20
    trapiResult.pfocr = trapiResult.pfocr.sort((figA, figB) => {
      return figB.score - figA.score;
    })
    .slice(0, 20);

  }

  // Each of the matched figures has at least one TRAPI result with an overlap of 2+ genes.
  // Each of the matched TRAPI results has at least one figure with an overlap of 2+ genes.
  debug(
    `${MATCH_COUNT_MIN}+ CURIE matches: ${matchedFigures.size} PFOCR figures and ${matchedTrapiResults.size} TRAPI results`
  );
}

module.exports.enrichTrapiResultsWithPfocrFigures = enrichTrapiResultsWithPfocrFigures;
