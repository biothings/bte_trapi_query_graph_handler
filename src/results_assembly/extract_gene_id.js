const { getPfocr } = require('./pfocr');

async function extractGeneId(ncbiGene){
            const arr = [];
            const res = await getPfocr(ncbiGene);
            for (var i = 0; i < res['hits'].length; i++) {
                arr.push(res['hits'][i]['associatedWith']['mentions']['genes']['ncbigene']);
            }
            return arr;
          }

// Test case
//const ncbiGene = ["ncbigene:10879", "ncbigene:7098"];
//extractGeneId(ncbiGene).then(val => {
//    console.log(val);
//    }).catch(e => {
//    console.log(e);
//  });
