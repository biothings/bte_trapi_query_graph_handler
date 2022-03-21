const debug = require('debug')('bte:biothings-explorer-trapi:Score');
const axios = require('axios');
const GraphHelper = require('./helper');
const helper = new GraphHelper();

async function getScores (dataByEdge) {
  let pairs = {};

  let combosWithoutResults = 0;

  Object.keys(dataByEdge).forEach((edge_key) => {
    dataByEdge[edge_key].records.forEach((record) => {
      let inputUMLS = helper._getInputUMLS(record) || [];
      let outputUMLS = helper._getOutputUMLS(record) || [];

      inputUMLS?.forEach((input_umls) => {
        if (!pairs.hasOwnProperty(input_umls)) {
          pairs[input_umls] = new Set();
        }
        outputUMLS?.forEach((output_umls) => {
          pairs[input_umls].add(output_umls);
        })
      });
      
      if (inputUMLS.length == 0 || outputUMLS.length == 0) {
        // debug("NO RESULT", helper._getInputCurie(record), helper._getInputUMLS(record), helper._getOutputCurie(record), helper._getOutputUMLS(record))
        combosWithoutResults++;
      }
    });
  });

  let queries = Object.keys(pairs).map((inputUMLS) => {
    return [...pairs[inputUMLS]].map((outputUMLS) => ([inputUMLS, outputUMLS]));
  }).flat();


  let results = await axios.post("http://biothings.ncats.io/semmeddb/query/ngd", {umls: queries});

  debug("Combos no UMLS ID (on input and/or output): ", combosWithoutResults);
  results = results.data.filter(combo => Number.isFinite(combo.ngd));
  debug("Combos with scores: ", results.length);

  return results;
}

//multiply the inverses of the ngds together to get the total score for a combo
function calculateScore(comboInfo, scoreCombos) {
  let score = 1;

  Object.keys(comboInfo).forEach((edgeKey) => {
    let multiplier = 0;

    for (const combo of scoreCombos) {
      if (comboInfo[edgeKey].inputUMLS?.includes(combo.umls[0]) && comboInfo[edgeKey].outputUMLS?.includes(combo.umls[1])) {
        multiplier = Math.max(1/combo.ngd, multiplier);
      }
    }

    score *= multiplier;
  })

  return score;
}

module.exports.getScores = getScores;
module.exports.calculateScore = calculateScore;
