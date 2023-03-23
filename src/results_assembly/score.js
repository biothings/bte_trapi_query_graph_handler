const debug = require('debug')('bte:biothings-explorer-trapi:Score');
const axios = require('axios');

const _ = require('lodash');
const tuning_param = 3;

async function query(queryPairs) {
  const url = 'https://biothings.ncats.io/semmeddb/query/ngd';
  const batchSize = 1000;

  debug("Querying", queryPairs.length, "combos.");

  let chunked_input = _.chunk(queryPairs, batchSize);
  try {
    let axios_queries = chunked_input.map((input) => {
      return axios.post(
        url,
        {
          umls: input,
          expand: "both"
        },
      );
    });
    //convert res array into single object with all curies
    let res = await Promise.all(axios_queries);
    res = res.map(r => r.data.filter(combo => Number.isFinite(combo.ngd))).flat(); // get numerical scores and flatten array
    return res;
  } catch (err) {
    debug("Failed to query for scores: ", err);
  }
}

async function getScores (recordsByQEdgeID) {
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
        })
      });

      if (inputUMLS.length == 0 || outputUMLS.length == 0) {
        // debug("NO RESULT", record.subject.curie, record.subject.UMLS, record.object.curie, record.object.UMLS)
        combosWithoutIDs++;
      }
    });
  });

  let queries = Object.keys(pairs).map((inputUMLS) => {
    return [...pairs[inputUMLS]].map((outputUMLS) => ([inputUMLS, outputUMLS]));
  }).flat();


  let results = await query(queries);

  debug("Combos no UMLS ID: ", combosWithoutIDs);
  return results || []; // in case results is undefined, avoid TypeErrors
}

// //multiply the inverses of the ngds together to get the total score for a combo
// function calculateScore(comboInfo, scoreCombos) {
//   let score = 1;

//   Object.keys(comboInfo).forEach((edgeKey) => {
//     let multiplier = 0;

//     for (const combo of scoreCombos) {
//       if (comboInfo[edgeKey].inputUMLS?.includes(combo.umls[0]) && comboInfo[edgeKey].outputUMLS?.includes(combo.umls[1])) {
//         multiplier = Math.max(1/combo.ngd, multiplier);
//       }
//     }

//     score *= multiplier;
//   })

//   return score;
// }

// sigmoid function scaled from 0 to 1
function scaled_sigmoid (input) {
  const tuned_input = Math.max(input, 0)/tuning_param;
  const sigmoid = 1/(1 + Math.exp(-tuned_input))
  return sigmoid * 2 - 1;
}

function reverse_scaled_sigmoid (score) {
  const unscaled_sigmoid = (score + 1)/2;
  const tuned_input = -Math.log(1/unscaled_sigmoid - 1);
  return tuned_input * tuning_param;
}

//addition of scores
function calculateScore(comboInfo, scoreCombos) {
  let score = 0;
  let scoredByNGD = false;
  Object.keys(comboInfo).forEach((edgeKey) => {
    score += 0.1 * comboInfo[edgeKey].recordHashes.size;
    for (const combo of scoreCombos) {
      if (comboInfo[edgeKey].inputUMLS?.includes(combo.umls[0]) && comboInfo[edgeKey].outputUMLS?.includes(combo.umls[1])) {
        score += 1/combo.ngd;
        scoredByNGD = true;
      }
    }
  })

  return { score: scaled_sigmoid(score), scoredByNGD };
}

//adds two normalized scores
function addNormalizedScores(score1, score2) {
  return scaled_sigmoid(reverse_scaled_sigmoid(score1) + reverse_scaled_sigmoid(score2));
}

module.exports.getScores = getScores;
module.exports.calculateScore = calculateScore;
module.exports.addNormalizedScores = addNormalizedScores;
