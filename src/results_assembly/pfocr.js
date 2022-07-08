const debug = require('debug')('bte:biothings-explorer-trapi:Score');
const axios = require('axios');

const _ = require('lodash');

async function getPfocr(gene) {
  const lowerGene = gene.map(element => {
    return element.toLowerCase();
  });
  const query = "q=associatedWith.mentions.genes." + lowerGene.join(' OR associatedWith.mentions.genes.');
  const url = 'https://biothings.ncats.io/pfocr/query?';
  const response = axios.get(url + query + "&fetch_all=true");
  return response
    .then(result => { return result['data']; })
    .catch(error => { return Promise.reject(error); });
}

module.exports.getPfocr = getPfocr;

// Test case
//const ncbiGene = ["ncbigene:10879", "ncbigene:7098"];
//getPfocr(ncbiGene).then(val => {
//    console.log(val);
//    }).catch(e => {
//    console.log(e);
//  });
