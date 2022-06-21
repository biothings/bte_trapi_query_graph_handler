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
    const fnames = await fs.readdir(path.resolve(__dirname, `../data/templates/${groupDir}`));
    const templates = await async.mapSeries(fnames, async (fname) => {
      // read templates
      return JSON.parse(await fs.readFile(path.resolve(__dirname, `../data/templates/${groupDir}`, fname))).message
        .query_graph;
    });
    return [...arr, ...templates];
  });
  return matchingTemplates;
};
