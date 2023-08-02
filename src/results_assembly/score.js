const debug = require('debug')('bte:biothings-explorer-trapi:Score');
const axios = require('axios');

const _ = require('lodash');

const tuning_param = 2.0;

const record_weight = 1.0;
const text_mined_record_weight = 0.5;
const ngd_weight = 0.25;
const LENGTH_PENALTY = 2.0;

// create lookup table for ngd scores in the format: {inputUMLS-outputUMLS: ngd}
async function query(queryPairs) {
  const url = 'https://biothings.ncats.io/semmeddb/query/ngd';
  const batchSize = 1000;

  debug('Querying', queryPairs.length, 'combos.');

  let chunked_input = _.chunk(queryPairs, batchSize);
  try {
    let axios_queries = chunked_input.map((input) => {
      return axios.post(url, {
        umls: input,
        expand: 'both',
      });
    });
    //convert res array into single object with all curies
    let res = await Promise.all(axios_queries);
    res = res.map((r) => r.data.filter((combo) => Number.isFinite(combo.ngd))).flat(); // get numerical scores and flatten array
    return res.reduce((acc, cur) => ({...acc, [`${cur.umls[0]}-${cur.umls[1]}`]: cur.ngd}), {});
  } catch (err) {
    debug('Failed to query for scores: ', err);
  }
}

// retrieve all ngd scores at once
async function getScores(recordsByQEdgeID) {
  let pairs = {};

  let combosWithoutIDs = 0;

  Object.keys(recordsByQEdgeID).forEach((edge_key) => {
    recordsByQEdgeID[edge_key].records.forEach((record) => {
      let inputUMLS = record.subject.UMLS || [];
      let outputUMLS = record.object.UMLS || [];

      inputUMLS?.forEach((input_umls) => {
        if (!pairs.hasOwnProperty(input_umls)) {
          pairs[input_umls] = new Set();
        }
        outputUMLS?.forEach((output_umls) => {
          pairs[input_umls].add(output_umls);
        });
      });

      if (inputUMLS.length == 0 || outputUMLS.length == 0) {
        // debug("NO RESULT", record.subject.curie, record.subject.UMLS, record.object.curie, record.object.UMLS)
        combosWithoutIDs++;
      }
    });
  });

  let queries = Object.keys(pairs)
    .map((inputUMLS) => {
      return [...pairs[inputUMLS]].map((outputUMLS) => [inputUMLS, outputUMLS]);
    })
    .flat();

  let results = await query(queries);

  debug('Combos no UMLS ID: ', combosWithoutIDs);
  return results || {}; // in case results is undefined, avoid TypeErrors
}

// sigmoid function scaled from 0 to 1
function scaled_sigmoid(input) {
  const tuned_input = Math.max(input, 0) / tuning_param;
  const sigmoid = 1 / (1 + Math.exp(-tuned_input));
  return sigmoid * 2 - 1;
}

function calculateScore(comboInfo, scoreCombos) {
  const sum = array => array.reduce((a, b) => a + b, 0);
  const average = array => array.length ? sum(array) / array.length : 0;

  let score = 0;
  let scoredByNGD = false;
  let edgeScores = {};
  let nodeDegrees = {};
  let edgesStartingFromNode = {};
  for (const [idx, edge] of comboInfo.entries()) {
    // keep track of indegrees and outdegrees to find start and end nodes later
    if (nodeDegrees.hasOwnProperty(edge.inputQNodeID)) {
      nodeDegrees[edge.inputQNodeID].out += 1;
    } else {
      nodeDegrees[edge.inputQNodeID] = { in: 0, out: 1 };
    }

    if (nodeDegrees.hasOwnProperty(edge.outputQNodeID)) {
      nodeDegrees[edge.outputQNodeID].in += 1;
    } else {
      nodeDegrees[edge.outputQNodeID] = { in: 1, out: 0 };
    }

    // track edge connections to find paths
    if (edgesStartingFromNode.hasOwnProperty(edge.inputQNodeID)) {
      edgesStartingFromNode[edge.inputQNodeID].push(idx);
    } else {
      edgesStartingFromNode[edge.inputQNodeID] = [idx];
    }

    let record_scores = edge.isTextMined.reduce((acc, val) => (
      acc + (val ? text_mined_record_weight : record_weight)
    ), 0);

    // compute ngd score for node pair
    pairs = [];
    edge.inputUMLS.forEach((inputUMLS) => {
      edge.outputUMLS.forEach((outputUMLS) => {
        pairs.push(`${inputUMLS}-${outputUMLS}`);
      });
    });
    ngd_scores = [];
    pairs.forEach((pair) => {
      if (scoreCombos.hasOwnProperty(pair)) {
        ngd = scoreCombos[pair];
        ngd_scores.push(1 / ngd);
        scoredByNGD = true;
      }
    });

    edgeScores[idx] = ngd_weight * average(ngd_scores) + record_scores;
  }

  //bfs to find paths
  let startNode = Object.keys(nodeDegrees).find(node => nodeDegrees[node].in === 0);
  let endNode = Object.keys(nodeDegrees).find(node => nodeDegrees[node].out === 0);

  let queue = [[startNode, 0, 0]];
  
  while (queue.length > 0) {
    let node, path_score, path_length;
    [node, path_score, path_length] = queue.shift();
    if (node === endNode) {
      score += path_score / Math.pow(path_length, LENGTH_PENALTY);
    } else if (edgesStartingFromNode.hasOwnProperty(node)) {
      for (let edgeIdx of edgesStartingFromNode[node]) {
        queue.push([comboInfo[edgeIdx].outputQNodeID, path_score + edgeScores[edgeIdx], path_length + 1]);
      }
    }
  }
  return { score: scaled_sigmoid(score), scoredByNGD };
}

module.exports.getScores = getScores;
module.exports.calculateScore = calculateScore;
module.exports.exportForTesting = {
  record_weight, text_mined_record_weight, ngd_weight, LENGTH_PENALTY, scaled_sigmoid
};
