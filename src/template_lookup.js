const fs = require('fs').promises;
const path = require('path');
const async = require('async');

exports.getTemplates = async (lookups) => {
  const getFiles = async (dir) => {
    const rootFiles = await fs.readdir(path.resolve(dir));
    return await async.reduce(rootFiles, [], async (arr, fname) => {
      const fPath = path.join(dir, fname);
      if ((await fs.lstat(fPath)).isDirectory()) {
        return [...arr, ...(await getFiles(fPath))];
      }
      return [...arr, fPath];
    });
  };
  const templatePathsOnly = await getFiles(path.resolve(__dirname, '../data/templates'));
  const templatePaths = Object.fromEntries(
    templatePathsOnly.map((templatePath) => {
      return [path.basename(templatePath), templatePath];
    }),
  );
  const templateGroups = JSON.parse(await fs.readFile(path.resolve(__dirname, '../data/templateGroups.json')));
  const matchingTemplatePaths = [
    ...templateGroups.reduce((matches, group) => {
      const lookupMatch = lookups.some((lookup) => {
        return (
          group.subject.includes(lookup.subject) &&
          group.object.includes(lookup.object) &&
          group.predicate.includes(lookup.predicate)
        );
      });

      if (lookupMatch) {
        group.templates.forEach((template) => {
          if (!matches.includes(templatePaths[template])) {
            matches.push(templatePaths[template])
          }
        });
      }
      return matches;
    }, []),
  ];
  return await async.map(matchingTemplatePaths, async (templatePath) => {
    return JSON.parse(await fs.readFile(templatePath)).message.query_graph;
  });
};

exports.getTemplatesOld = async (filterStrings) => {
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
