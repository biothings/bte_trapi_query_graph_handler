const fs = require('fs').promises;
const path = require('path');
const async = require('async');

exports.getTemplates = async (filterStrings) => {
  const templateGroups = await fs.readdir(path.resolve(__dirname, '../data/templates'));
  let matchingTemplates = templateGroups.filter((groupDir) => {
    // get compatible template groups
    return filterStrings.some((filterString) => {
      return filterString === groupDir;
    });
  });
  matchingTemplates = await async.reduce(matchingTemplates, [], async (arr, groupDir) => {
    // get templates
    let fnames = await fs.readdir(path.resolve(__dirname, `../data/templates/${groupDir}`));
    fnames = fnames.sort((a, b) => {
      let aNum = a.match(/^[0-9]+/g);
      let bNum = a.match(/^[0-9]+/g);
      aNum = aNum ? parseInt(aNum[0]) : Infinity;
      bNum = bNum ? parseInt(bNum[0]) : Infinity;
      return a - b ? a - b : 0;
    });
    const templates = await async.mapSeries(fnames, async (fname) => {
      // read templates
      return JSON.parse(await fs.readFile(path.resolve(__dirname, `../data/templates/${groupDir}`, fname))).message
        .query_graph;
    });
    return [...arr, ...templates];
  });
  return matchingTemplates;
};
