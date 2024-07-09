import Debug from 'debug';
import axios from 'axios';
const debug = Debug('bte:biothings-explorer-trapi:score');
import os from 'os';
import async from 'async';

import _ from 'lodash';
import { ConsolidatedSolutionRecord, RecordsByQEdgeID } from './query_results';
import { Telemetry } from '@biothings-explorer/utils';

const tuning_param = 1.8;

const record_weight = 1.0;
const text_mined_record_weight = 0.5;
const ngd_weight = 0.25;
const LENGTH_PENALTY = 2.0;

interface ngdScoreCombo {
  ngd: number;
  umls: string[];
}

export interface ScoreCombos {
  [umlsPair: string]: number;
}

// create lookup table for ngd scores in the format: {inputUMLS-outputUMLS: ngd}
async function query(queryPairs: string[][]): Promise<ScoreCombos> {
  const NGD_TIMEOUT = process.env.NGD_TIMEOUT_MS ? parseInt(process.env.NGD_TIMEOUT_MS) : 10 * 1000;

  const url = {
    dev: 'https://biothings.ci.transltr.io/semmeddb/query/ngd',
    ci: 'https://biothings.ci.transltr.io/semmeddb/query/ngd',
    test: 'https://biothings.test.transltr.io/semmeddb/query/ngd',
    prod: 'https://biothings.ncats.io/semmeddb/query/ngd',
  }[process.env.INSTANCE_ENV ?? 'prod'];
  const batchSize = 250;
  const concurrency_limit = 100; // server handles ~100 requests per second

  debug('Querying', queryPairs.length, 'combos.');

  const chunked_input = _.chunk(queryPairs, batchSize);
  const start = Date.now();

  try {
    const response = await async.mapLimit(chunked_input, concurrency_limit, async (input) => {
      if (Date.now() - start > NGD_TIMEOUT) return;

      const span = Telemetry.startSpan({ description: 'NGDScoreRequest' });
      const data = {
        umls: input,
        expand: 'both',
      };
      span.setData('requestBody', data);
      try {
        // const start = performance.now();
        const response = await axios.post(url, data);
        // const end = performance.now();
        span.finish();
        return response;
      } catch (err) {
        debug(`NGD score query failed: ${err}`);
        span.finish();
      }
    });
    //convert res array into single object with all curies
    const result = response
      .filter(r => r != undefined)
      .map((r): ngdScoreCombo[] => r.data.filter((combo: ngdScoreCombo) => Number.isFinite(combo.ngd)))
      .flat(); // get numerical scores and flatten array
    return result.reduce((acc, cur) => ({ ...acc, [`${cur.umls[0]}-${cur.umls[1]}`]: cur.ngd }), {});
  } catch (err) {
    debug('Failed to query for scores: ', err);
  }
}

// retrieve all ngd scores at once
export async function getScores(recordsByQEdgeID: RecordsByQEdgeID): Promise<ScoreCombos> {
  const pairsToAdd: { [recordHash: string]: string[] } = {};

  let combosWithoutIDs = 0;

  Object.values(recordsByQEdgeID).forEach(({ records }) => {
    records.forEach((record) => {
      const inputUMLS = record.subject.UMLS || [];
      const outputUMLS = record.object.UMLS || [];
      const hash = record.recordHash;

      inputUMLS?.forEach((input_umls) => {
        if (!(hash in pairsToAdd)) {
          pairsToAdd[hash] = [];
        }
        outputUMLS?.forEach((output_umls) => {
          pairsToAdd[hash].push(`${input_umls}\n${output_umls}`);
        });
      });

      if (inputUMLS.length == 0 || outputUMLS.length == 0) {
        // debug("NO RESULT", record.subject.curie, record.subject.UMLS, record.object.curie, record.object.UMLS)
        combosWithoutIDs++;
      }
    });
  });

  // organize queries to be distributed among different records
  const pairs = new Set<string>();
  let running = true;
  while (running) {
    running = false;
    for (const hash in pairsToAdd) {
      if (pairsToAdd[hash].length > 0) {
        pairs.add(pairsToAdd[hash].pop());
        running = true;
      }
      if (pairsToAdd[hash].length == 0) {
        delete pairsToAdd[hash];
      }
    }
  }

  const results = await query([...pairs].map(p => p.split('\n')));

  debug('Combos no UMLS ID: ', combosWithoutIDs);
  return results || {}; // in case results is undefined, avoid TypeErrors
}

// sigmoid function scaled from 0 to 1
export function scaled_sigmoid(input: number): number {
  const tuned_input = Math.max(input, 0) / tuning_param;
  return (2 / Math.PI) * Math.atan(tuned_input);
}

export function inverse_scaled_sigmoid(input: number): number {
  return tuning_param * Math.tan((2 / Math.PI) * input);
}

export function calculateScore(
  comboInfo: ConsolidatedSolutionRecord[],
  scoreCombos: ScoreCombos,
): { score: number; scoredByNGD: boolean } {
  const sum = (array: number[]) => array.reduce((a, b) => a + b, 0);
  const average = (array: number[]) => (array.length ? sum(array) / array.length : 0);

  let score = 0;
  let scoredByNGD = false;
  const edgeScores: { [index: number]: number } = {};
  const nodeDegrees: { [qNodeID: string]: { in: number; out: number } } = {};
  const edgesStartingFromNode = {};
  for (const [idx, edge] of comboInfo.entries()) {
    // keep track of indegrees and outdegrees to find start and end nodes later
    if (edge.inputQNodeID in nodeDegrees) {
      nodeDegrees[edge.inputQNodeID].out += 1;
    } else {
      nodeDegrees[edge.inputQNodeID] = { in: 0, out: 1 };
    }

    if (edge.outputQNodeID in nodeDegrees) {
      nodeDegrees[edge.outputQNodeID].in += 1;
    } else {
      nodeDegrees[edge.outputQNodeID] = { in: 1, out: 0 };
    }

    // track edge connections to find paths
    if (edge.inputQNodeID in edgesStartingFromNode) {
      edgesStartingFromNode[edge.inputQNodeID].push(idx);
    } else {
      edgesStartingFromNode[edge.inputQNodeID] = [idx];
    }

    const record_scores = edge.isTextMined.reduce(
      (acc, val) => acc + (val ? text_mined_record_weight : record_weight),
      0,
    );

    // compute ngd score for node pair
    const pairs = [];
    edge.inputUMLS.forEach((inputUMLS) => {
      edge.outputUMLS.forEach((outputUMLS) => {
        pairs.push(`${inputUMLS}-${outputUMLS}`);
      });
    });
    const ngd_scores = [];
    pairs.forEach((pair) => {
      if (pair in scoreCombos) {
        const ngd = scoreCombos[pair];
        ngd_scores.push(1 / ngd);
        scoredByNGD = true;
      }
    });

    edgeScores[idx] = ngd_weight * average(ngd_scores) + record_scores;
  }

  //bfs to find paths
  const startNode = Object.keys(nodeDegrees).find((node) => nodeDegrees[node].in === 0);
  const endNode = Object.keys(nodeDegrees).find((node) => nodeDegrees[node].out === 0);

  const queue: [string, number, number][] = [[startNode, 0, 0]];

  while (queue.length > 0) {
    const [node, path_score, path_length]: [node: string, path_score: number, path_length: number] = queue.shift();
    if (node === endNode) {
      score += path_score / Math.pow(path_length, LENGTH_PENALTY);
    } else if (node in edgesStartingFromNode) {
      for (const edgeIdx of edgesStartingFromNode[node]) {
        queue.push([comboInfo[edgeIdx].outputQNodeID, path_score + edgeScores[edgeIdx], path_length + 1]);
      }
    }
  }
  return { score: scaled_sigmoid(score), scoredByNGD };
}

const exportForTesting = {
  record_weight,
  text_mined_record_weight,
  ngd_weight,
  LENGTH_PENALTY,
  scaled_sigmoid,
};

export { exportForTesting };
