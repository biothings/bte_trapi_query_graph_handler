import axios from 'axios';
import Debug from 'debug';
const debug = Debug('bte:biothings-explorer-trapi:pfocr');
import { intersection } from '../utils';
import _ from 'lodash';
import { LogEntry, StampedLog } from '@biothings-explorer/utils';
import { TrapiResult, TrapiKGNode, TrapiResponse, TrapiKGEdge } from '@biothings-explorer/types';
import Graph from '../graph/graph';

// the minimum acceptable intersection size between the CURIEs
// in a TRAPI result and in a PFOCR figure.
const MATCH_COUNT_MIN = 2;
const FIGURE_COUNT_MAX = 20;
const SUPPORTED_PREFIXES = {
  NCBIGene: 'associatedWith.mentions.genes.ncbigene',
};

interface pfocrQueryBody {
  q: string[];
  scopes: string;
  fields: string[];
  operator: string;
  analyzer: string;
  minimum_should_match: number;
  size: number;
  with_total: boolean;
  from?: number;
}

interface FigureResult {
  _id: string;
  notfound?: boolean;
  associatedWith: {
    figureUrl: string;
    pfocrUrl: string;
    pmc: string;
    mentions: {
      genes: {
        ncbigene: string[];
      };
    };
  };
}

interface RawFigureResult extends FigureResult {
  query: string;
}

interface DeDupedFigureResult extends FigureResult {
  query: Set<string>;
}

/* Get all results by using a scrolling query
 * https://docs.mygene.info/en/latest/doc/query_service.html#scrolling-queries
 * Using new POST scrolling behavior here:
 * https://github.com/newgene/biothings.api/pull/52
 * All queries must include size: 1000, with_total: true
 * Subsequent queries must use `from` to designate a starting point
 */
async function getAllByScrolling(
  baseUrl: string,
  queryBody: pfocrQueryBody,
  batchIndex: number,
  hits: RawFigureResult[] = [],
): Promise<RawFigureResult[]> {
  queryBody.from = batchIndex;
  let data: { hits: RawFigureResult[]; max_total: number };
  try {
    data = (await axios.post(baseUrl, queryBody, { timeout: 15000 })).data;
  } catch (err) {
    debug(`Error in scrolling request window ${batchIndex}-${batchIndex + 1000}, error is ${(err as Error).message}`);
  }

  if (data) {
    hits.push(...data.hits);
    debug(`Batch window ${batchIndex}-${batchIndex + 1000}: ${data.hits.length} hits retrieved for PFOCR figure data`);
  }

  if (data && batchIndex + 1000 < data.max_total) {
    return await getAllByScrolling(baseUrl, queryBody, batchIndex + 1000, hits);
  } else {
    return hits;
  }
}

/* qTerms are the CURIEs that go with the 'q' query parameter.
 */
async function getPfocrFigures(qTerms: Set<string>): Promise<DeDupedFigureResult[]> {
  debug(`Getting PFOCR figure data`);
  const url = {
    dev: 'https://biothings.ci.transltr.io/pfocr/query',
    ci: 'https://biothings.ci.transltr.io/pfocr/query',
    test: 'https://biothings.test.transltr.io/pfocr/query',
    prod: 'https://biothings.ncats.io/pfocr/query',
  }[process.env.INSTANCE_ENV ?? 'prod'];
  /*
   * We can now POST using minimum_should_match to bypass most set logic on our side
   * detailed here: https://github.com/biothings/pending.api/issues/88
   */

  const figureResults: RawFigureResult[] = [];
  await Promise.all(
    _.chunk([...qTerms], 1000).map(async (qTermBatch) => {
      const queryBody = {
        q: [...qTermBatch],
        scopes: 'associatedWith.mentions.genes.ncbigene', // TODO better system when we use more than NCBIGene
        fields: [
          '_id',
          'associatedWith.mentions.genes.ncbigene',
          'associatedWith.pmc',
          'associatedWith.figureUrl',
          'associatedWith.pfocrUrl',
        ],
        operator: 'OR',
        analyzer: 'whitespace',
        minimum_should_match: MATCH_COUNT_MIN,
        size: 1000,
        with_total: true,
      };

      figureResults.push(...(await getAllByScrolling(url, queryBody, 0)));
    }),
  ).catch((err) => {
    debug('Error getting PFOCR figures (getPfocrFigures)', err);
    throw err;
  });

  /*
   * When we make separate queries for different CURIEs, we can get
   * duplicate figures, so we need to de-duplicate.
   */
  const mergedFigureResults: { [figureID: string]: DeDupedFigureResult } = {};
  const figuresAdded = new Set();
  figureResults.map((figure) => {
    const figureId = figure._id;
    if (!figure.notfound && !figuresAdded.has(figureId)) {
      figuresAdded.add(figureId);
      mergedFigureResults[figureId] = { ...figure, query: new Set([figure.query]) };
    } else if (!figure.notfound && figuresAdded.has(figureId)) {
      mergedFigureResults[figureId].query.add(figure.query);
    }
  });

  debug(`${Object.values(mergedFigureResults).length} total PFOCR figure hits retrieved`);
  return Object.values(mergedFigureResults);
}

function traverseResultForNodes(result: TrapiResult, response: TrapiResponse): Set<TrapiKGNode> {
  const kg = response.message.knowledge_graph;
  const nodes: Set<TrapiKGNode> = new Set();
  const edgeStack: TrapiKGEdge[] = [];
  Object.values(result.node_bindings).forEach((bindings) =>
    bindings.forEach((binding) => nodes.add(kg.nodes[binding.id])),
  );
  Object.values(result.analyses[0].edge_bindings).forEach((bindings) =>
    bindings.forEach((binding) => edgeStack.push(kg.edges[binding.id])),
  );

  while (edgeStack.length > 0) {
    const edge = edgeStack.pop();
    nodes.add(kg.nodes[edge.object]);
    nodes.add(kg.nodes[edge.subject]);
    const supportGraphs = edge.attributes.find((attribute) => attribute.attribute_type_id == 'biolink:support_graphs');
    if (supportGraphs) {
      (supportGraphs.value as string[]).forEach((auxGraphID) =>
        response.message.auxiliary_graphs[auxGraphID].edges.forEach((edgeID) => edgeStack.push(kg.edges[edgeID])),
      );
    }
  }

  return nodes;
}

/* time complexity: O(t*f)
 * where
 * t: trapiResults.length
 * f: figures.length
 */
export async function enrichTrapiResultsWithPfocrFigures(response: TrapiResponse): Promise<StampedLog[]> {
  // NOTE: This function operates on the actual TRAPI information that will be returned
  // to the client. Don't mutate what shouldn't be mutated!
  const results = response.message.results;
  const logs: StampedLog[] = [];
  let resultsWithTruncatedFigures = 0;
  const truncatedFigures: Set<string> = new Set();

  const curieCombosByResult: Map<TrapiResult, string> = new Map();
  const curiesByResult: Map<TrapiResult, Set<string>> = new Map();

  const curieCombos: Set<string> = results.reduce((combos: Set<string>, result: TrapiResult) => {
    const nodes: Set<TrapiKGNode> = traverseResultForNodes(result, response);
    const combo: Set<string> = new Set();
    let matchedNodes = 0;
    [...nodes].forEach((node) => {
      let nodeMatched = false;
      const equivalentCuries = node.attributes?.find((attribute) => attribute.attribute_type_id === 'biolink:xref')
        .value as string[];
      equivalentCuries.forEach((curie) => {
        const prefix = curie.split(':')[0];
        const suffix = curie.replace(`${prefix}:`, '');
        if (Object.keys(SUPPORTED_PREFIXES).includes(prefix)) {
          combo.add(suffix);
          nodeMatched = true;
        }
      });
      if (nodeMatched) matchedNodes += 1;
    });
    if (matchedNodes >= MATCH_COUNT_MIN) {
      const comboString = [...combo].join(' ');
      curieCombosByResult.set(result, comboString);
      combos.add(comboString);
      curiesByResult.set(result, combo);
    }
    return combos;
  }, new Set<string>());

  if (curieCombos.size < 1) {
    // No TRAPI result can satisfy MATCH_COUNT_MIN
    logs.push(new LogEntry('DEBUG', null, 'Query does not match criteria, skipping PFOCR figure enrichment.').getLog());
    return logs;
  }

  let figures: DeDupedFigureResult[];
  try {
    figures = await getPfocrFigures(curieCombos);
  } catch (err) {
    debug('Error getting PFOCR figures (enrichTrapiResultsWithPfocrFigures)', (err as Error).message);
    logs.push(
      new LogEntry(
        'WARNING',
        null,
        `Error getting PFOCR figures, results will not be enriched. The error is ${err.message}`,
      ).getLog(),
    );
  }
  if (!figures) return logs;

  debug(`${figures.length} PFOCR figures match at least ${MATCH_COUNT_MIN} nodes from any TRAPI result`);

  const figuresByCuries: { [queryCuries: string]: DeDupedFigureResult[] } = {};
  figures.forEach((figure) => {
    [...figure.query].forEach((queryCuries) => {
      figuresByCuries[queryCuries] =
        queryCuries in figuresByCuries ? [...figuresByCuries[queryCuries], figure] : [figure];
    });
  });

  const matchedFigures: Set<string> = new Set();
  const matchedTrapiResults: Set<TrapiResult> = new Set();

  const allGenesInAllFigures = figures.reduce((set, fig) => {
    fig.associatedWith.mentions.genes.ncbigene.forEach((gene) => set.add(gene));
    return set;
  }, new Set() as Set<string>);

  for (const trapiResult of results) {
    // No figures match this result
    if (!figuresByCuries[curieCombosByResult.get(trapiResult)]) continue;

    const resultCuries = curiesByResult.get(trapiResult);
    const resultGenesInAllFigures = intersection(allGenesInAllFigures, resultCuries);

    (figuresByCuries[curieCombosByResult.get(trapiResult)] ?? []).forEach((figure) => {
      if (!('pfocr' in trapiResult)) {
        trapiResult.pfocr = [];
      }

      const figureCurieSet = new Set(figure.associatedWith.mentions.genes.ncbigene);
      const resultGenesInFigure = intersection(resultCuries, figureCurieSet);

      // let otherGenesInOtherFigures = [...allGenesInAllFigures].filter((gene) => {
      //   return !resultCuries.has(gene) && !figureCurieSet.has(gene);
      // }).length;

      const precision = resultGenesInFigure.size / figureCurieSet.size;
      const recall = resultGenesInFigure.size / resultGenesInAllFigures.size;

      trapiResult.pfocr.push({
        figureUrl: figure.associatedWith.figureUrl,
        pfocrUrl: figure.associatedWith.pfocrUrl,
        pmc: figure.associatedWith.pmc,
        // TODO: do we want to include figure title? Note: this would need to be added to queryBody.
        //title: figure.associatedWith.title,
        matchedCuries: [...resultGenesInFigure].map((geneID) => `NCBIGene:${geneID}`),
        score: 2 * ((precision * recall) / (precision + recall)),
      });
      matchedTrapiResults.add(trapiResult);
    });

    // Sort by score and cut down to top 20
    const sortedFigures = trapiResult.pfocr.sort((figA, figB) => {
      return figB.score - figA.score;
    });

    if (sortedFigures.length > FIGURE_COUNT_MAX) {
      resultsWithTruncatedFigures += 1;
      sortedFigures.slice(0, 20).forEach((figure) => truncatedFigures.add(figure.figureUrl));
      // debug(`Truncating ${sortedFigures.length} PFOCR figures to ${FIGURE_COUNT_MAX} for TRAPI result w/ curies ${trapiResultToCurieSet.get(trapiResult).split(' ').map((ID) => `NCBIGene:${ID}`).join(', ')}`)
    }

    trapiResult.pfocr = sortedFigures.slice(0, 20);
    trapiResult.pfocr.map((figure) => matchedFigures.add(figure.figureUrl));
  }

  // Each of the matched figures has at least one TRAPI result with an overlap of 2+ genes.
  // Each of the matched TRAPI results has at least one figure with an overlap of 2+ genes.
  const unusedFigures = [...truncatedFigures].filter((figureUrl) => !matchedFigures.has(figureUrl)).length;
  const message = `${resultsWithTruncatedFigures} results had pfocr figures truncated to max of 20 (${truncatedFigures.size} unique figures removed, ${unusedFigures} not appearing elsewhere in results).`;
  debug(message);
  logs.push(new LogEntry('DEBUG', null, message).getLog());
  debug(
    `${MATCH_COUNT_MIN}+ node matches: ${matchedFigures.size} PFOCR figures across ${matchedTrapiResults.size} TRAPI results`,
  );
  logs.push(
    new LogEntry(
      'INFO',
      null,
      `${matchedTrapiResults.size} results successfully enriched with ${matchedFigures.size} unique PFOCR figures.`,
    ).getLog(),
  );

  return logs;
}

module.exports.enrichTrapiResultsWithPfocrFigures = enrichTrapiResultsWithPfocrFigures;
