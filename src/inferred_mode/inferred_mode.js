const debug = require('debug')('bte:biothings-explorer-trapi:inferred-mode');
const LogEntry = require('../log_entry');
const utils = require('../utils');
const async = require('async');
const biolink = require('../biolink');
const { getTemplates } = require('./template_lookup');

module.exports = async (parent, TRAPIQueryHandler, queryGraph, logs, options, path, predicatePath, includeReasoner) => {

    // TODO [POST-MVP] check for flipped predicate cases
    // i.e. Drug -treats-> Disease OR Disease -treated_by-> Drug
    let logMessage = 'Query proceeding in Inferred Mode.';
    debug(logMessage);
    logs.push(new LogEntry('INFO', null, logMessage).getLog());

    const nodeMissingCategory = Object.values(queryGraph.nodes).some((node) => {
      return typeof node.categories === 'undefined' || node.categories.length === 0;
    });
    if (nodeMissingCategory) {
      const message = 'All nodes in Inferred Mode edge must have categories. Your query terminates.';
      logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    const nodeMissingID = !Object.values(queryGraph.nodes).some((node) => {
      return typeof node.ids !== 'undefined' && node.ids.length > 0;
    });
    if (nodeMissingID) {
      const message = 'At least one node in Inferred Mode edge must have at least 1 ID. Your query terminates.';
      logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    const edgeMissingPredicate =
      typeof Object.values(queryGraph.edges)[0].predicates === 'undefined' ||
      Object.values(queryGraph.edges)[0].predicates.length < 1;
    if (edgeMissingPredicate) {
      const message = 'Inferred Mode edge must specify a predicate. Your query terminates.';
      logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    const tooManyIDs =
      1 <
      Object.values(queryGraph.nodes).reduce((sum, node) => {
        return typeof node.ids !== 'undefined' ? sum + node.ids.length : sum;
      }, 0);
    if (tooManyIDs) {
      const message = 'Inferred Mode queries with multiple IDs are not supported. Your query terminates.';
      logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    const multiplePredicates =
      Object.values(queryGraph.edges).reduce((sum, edge) => {
        return edge.predicates ? sum + edge.predicates.length : sum;
      }, 0) > 1;
    if (multiplePredicates) {
      const message = 'Inferred Mode queries with multiple predicates are not supported. Your query terminates.';
      logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    if (options.smartAPIID || options.teamName) {
      const message = 'Inferred Mode on smartapi/team-specific endpoints not supported. Your query terminates.';
      logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    const CREATIVE_LIMIT = 1000;

    const qEdgeID = Object.keys(queryGraph.edges)[0];
    const qEdge = queryGraph.edges[qEdgeID];
    const qSubject = queryGraph.nodes[qEdge.subject];
    const qObject = queryGraph.nodes[qEdge.object];
    debug('Looking up query Templates');
    const expandedSubject = qSubject.categories.reduce((arr, subjectCategory) => {
      return utils.getUnique([...arr, ...biolink.getDescendantClasses(utils.removeBioLinkPrefix(subjectCategory))]);
    }, []);
    const expandedPredicates = qEdge.predicates.reduce((arr, predicate) => {
      return utils.getUnique([...arr, ...biolink.getDescendantPredicates(utils.removeBioLinkPrefix(predicate))]);
    }, []);
    const expandedObject = qObject.categories.reduce((arr, objectCategory) => {
      return utils.getUnique([...arr, ...biolink.getDescendantClasses(utils.removeBioLinkPrefix(objectCategory))]);
    }, []);
    const lookupObjects = expandedSubject.reduce((arr, subjectCategory) => {
      let templates = expandedObject.reduce((arr2, objectCategory) => {
        return [
          ...arr2,
          ...expandedPredicates.map((predicate) => {
            return {
              subject: utils.removeBioLinkPrefix(subjectCategory),
              object: utils.removeBioLinkPrefix(objectCategory),
              predicate: utils.removeBioLinkPrefix(predicate),
            };
            // return `${utils.removeBioLinkPrefix(subjectCategory)}-${utils.removeBioLinkPrefix(
            //   predicate,
            // )}-${utils.removeBioLinkPrefix(objectCategory)}`;
          }),
        ];
      }, []);
      return [...arr, ...templates];
    }, []);
    const templates = await getTemplates(lookupObjects);

    logMessage = `Got ${templates.length} inferred query templates.`;
    debug(logMessage);
    logs.push(new LogEntry('INFO', null, logMessage).getLog());

    if (!templates.length) {
      logMessage = `No Templates matched your inferred-mode query. Your query terminates.`;
      debug(logMessage);
      logs.push(new LogEntry('WARNING', null, logMessage).getLog());
    }

    // combine creative query with templates
    const subQueries = templates.map((template) => {
      template.nodes.creativeQuerySubject.categories = [
        ...new Set([...template.nodes.creativeQuerySubject.categories, ...qSubject.categories]),
      ];
      const creativeQuerySubjectIDs = qSubject.ids ? qSubject.ids : [];
      template.nodes.creativeQuerySubject.ids = template.nodes.creativeQuerySubject.ids
        ? [...new Set([...template.nodes.creativeQuerySubject.ids, ...creativeQuerySubjectIDs])]
        : creativeQuerySubjectIDs;

      template.nodes.creativeQueryObject.categories = [
        ...new Set([...template.nodes.creativeQueryObject.categories, ...qObject.categories]),
      ];
      const qEdgeObjectIDs = qObject.ids ? qObject.ids : [];
      template.nodes.creativeQueryObject.ids = template.nodes.creativeQueryObject.ids
        ? [...new Set([...template.nodes.creativeQueryObject.ids, ...qEdgeObjectIDs])]
        : qEdgeObjectIDs;

      if (!template.nodes.creativeQuerySubject.categories.length) {
        delete template.nodes.creativeQuerySubject.categories;
      }
      if (!template.nodes.creativeQueryObject.categories.length) {
        delete template.nodes.creativeQueryObject.categories;
      }
      if (!template.nodes.creativeQuerySubject.ids.length) {
        delete template.nodes.creativeQuerySubject.ids;
      }
      if (!template.nodes.creativeQueryObject.ids.length) {
        delete template.nodes.creativeQueryObject.ids;
      }

      return template;
    });

    const combinedResponse = {
      workflow: [{ id: 'lookup' }],
      message: {
        query_graph: {},
        knowledge_graph: {
          nodes: {},
          edges: {},
        },
        results: {},
      },
      logs: logs,
    };
    const reservedIDs = {
      nodes: [qEdge.subject, qEdge.object],
      edges: [qEdgeID],
    };
    // add/combine nodes
    let resultQueries = [];
    let successfulQueries = 0;
    let stop = false;
    let mergedResultsCount = {};
    await async.eachOfSeries(subQueries, async (queryGraph, i) => {
      if (stop) {
        return;
      }
      const handler = new TRAPIQueryHandler(options, path, predicatePath, includeReasoner);
      handler.setQueryGraph(queryGraph);
      try {
        await handler.query();
        const response = handler.getResponse();

        // add non-duplicate nodes
        Object.entries(response.message.knowledge_graph.nodes).forEach(([curie, node]) => {
          if (!(curie in combinedResponse.message.knowledge_graph.nodes)) {
            combinedResponse.message.knowledge_graph.nodes[curie] = node;
          }
        });
        // add non-duplicate edges
        Object.entries(response.message.knowledge_graph.edges).forEach(([recordHash, edge]) => {
          if (!(recordHash in combinedResponse.message.knowledge_graph.edges)) {
            combinedResponse.message.knowledge_graph.edges[recordHash] = edge;
          }
        });
        // make unique node/edge ids for this sub-query's graph
        const nodeMapping = Object.fromEntries(
          Object.keys(response.message.query_graph.nodes).map((nodeID) => {
            let newID = nodeID;
            if (['creativeQuerySubject', 'creativeQueryObject'].includes(nodeID)) {
              newID = nodeID === 'creativeQuerySubject' ? qEdge.subject : qEdge.object;
            } else {
              while (reservedIDs.nodes.includes(newID)) {
                let number = newID.match(/[0-9]+$/);
                let newNumber = number ? `0${parseInt(number[0]) + 1}` : '01';
                newID = number ? newID.replace(number, newNumber) : `${newID}${newNumber}`;
              }
              reservedIDs.nodes.push(newID);
            }
            return [nodeID, newID];
          }),
        );
        const edgeMapping = Object.fromEntries(
          Object.keys(response.message.query_graph.edges).map((edgeID) => {
            let newID = edgeID;
            while (reservedIDs.edges.includes(newID)) {
              let number = newID.match(/[0-9]+$/);
              let newNumber = number ? `0${parseInt(number[0]) + 1}` : '01';
              newID = number ? newID.replace(number, newNumber) : `${newID}${newNumber}`;
            }
            reservedIDs.edges.push(newID);
            return [edgeID, newID];
          }),
        );
        // add results
        response.message.results.forEach((result) => {
          const translatedResult = {
            node_bindings: {},
            edge_bindings: {},
            score: result.score,
          };
          Object.entries(result.node_bindings).forEach(([nodeID, bindings]) => {
            translatedResult.node_bindings[nodeMapping[nodeID]] = bindings;
          });
          Object.entries(result.edge_bindings).forEach(([edgeID, bindings]) => {
            translatedResult.edge_bindings[edgeMapping[edgeID]] = bindings;
          });
          const resultCreativeSubjectID = translatedResult.node_bindings[nodeMapping['creativeQuerySubject']]
            .map((binding) => binding.id)
            .join(',');
          const resultCreativeObjectID = translatedResult.node_bindings[nodeMapping['creativeQueryObject']]
            .map((binding) => binding.id)
            .join(',');
          const resultID = `${resultCreativeSubjectID}-${resultCreativeObjectID}`;
          if (resultID in combinedResponse.message.results) {
            mergedResultsCount[resultID] = mergedResultsCount[resultID] ? mergedResultsCount[resultID] + 1 : 2; // accounting for initial + first merged
            Object.entries(translatedResult.node_bindings).forEach(([nodeID, bindings]) => {
              combinedResponse.message.results[resultID].node_bindings[nodeID] = bindings;
            });
            Object.entries(translatedResult.edge_bindings).forEach(([edgeID, bindings]) => {
              combinedResponse.message.results[resultID].edge_bindings[edgeID] = bindings;
            });

            const resScore = translatedResult.score;
            if (typeof combinedResponse.message.results[resultID].score !== 'undefined') {
              combinedResponse.message.results[resultID].score = resScore
                ? combinedResponse.message.results[resultID].score + resScore
                : combinedResponse.message.results[resultID].score;
            } else {
              combinedResponse.message.results[resultID].score = resScore;
            }
          } else {
            combinedResponse.message.results[resultID] = translatedResult;
          }
        });
        // fix/combine logs
        handler.logs.forEach((log) => {
          Object.entries(nodeMapping).forEach(([oldID, newID]) => {
            log.message = log.message.replace(oldID, newID);
          });
          Object.entries(edgeMapping).forEach(([oldID, newID]) => {
            log.message = log.message.replace(oldID, newID);
          });
          log.message = `[Template-${i}]: ${log.message}`;

          combinedResponse.logs.push(log);
        });

        if (response.message.results.length) {
          resultQueries.push(i);
        }
        successfulQueries += 1;

        if (Object.keys(combinedResponse.message.results).length >= CREATIVE_LIMIT && !stop) {
          stop = true;
          const message = [
            `Addition of ${Object.keys(response.message.results).length} results from Template ${i}`,
            Object.keys(combinedResponse.message.results).length === CREATIVE_LIMIT ? ' meets ' : ' exceeds ',
            `creative result maximum of ${CREATIVE_LIMIT} (reaching ${
              Object.keys(combinedResponse.message.results).length
            } merged). `,
            `Response will be truncated to top-scoring ${CREATIVE_LIMIT} results. Skipping remaining ${
              subQueries.length - (i + 1)
            } `,
            subQueries.length - (i + 1) === 1 ? `template.` : `templates.`
          ].join('');
          debug(message);
          combinedResponse.logs.push(new LogEntry(`INFO`, null, message).getLog());
        }

      } catch (error) {
        handler.logs.forEach((log) => {
          combinedResponse.logs.push(log);
        });
        const message = `ERROR: subQuery ${i} failed due to error ${error}`;
        debug(message);
        combinedResponse.logs.push(new LogEntry(`ERROR`, null, message).getLog());
        return;
      }

    });
    combinedResponse.message.query_graph = queryGraph;
    // sort records by score
    combinedResponse.message.results = Object.values(combinedResponse.message.results).sort((a, b) => {
      return b.score - a.score ? b.score - a.score : 0;
    });
    // trim extra results and kg
    combinedResponse.message.results = combinedResponse.message.results.slice(0, CREATIVE_LIMIT);

    debug('pruning creative combinedResponse nodes/edges...');
    const resultsBoundNodes = new Set();
    const resultsBoundEdges = new Set();

    combinedResponse.message.results.forEach((result) => {
      Object.entries(result.node_bindings).forEach(([node, bindings]) => {
        bindings.forEach((binding) => resultsBoundNodes.add(binding.id));
      });
      Object.entries(result.edge_bindings).forEach(([edge, bindings]) => {
        bindings.forEach((binding) => resultsBoundEdges.add(binding.id));
      });
    });

    const nodesToDelete = Object.keys(combinedResponse.message.knowledge_graph.nodes).filter(
      (bteNodeID) => !resultsBoundNodes.has(bteNodeID),
    );
    nodesToDelete.forEach((unusedBTENodeID) => delete combinedResponse.message.knowledge_graph.nodes[unusedBTENodeID]);
    const edgesToDelete = Object.keys(combinedResponse.message.knowledge_graph.edges).filter(
      (recordHash) => !resultsBoundEdges.has(recordHash),
    );
    edgesToDelete.forEach(
      (unusedRecordHash) => delete combinedResponse.message.knowledge_graph.edges[unusedRecordHash],
    );
    debug(`pruned ${nodesToDelete.length} nodes and ${edgesToDelete.length} edges from combinedResponse.`);

    if (Object.keys(mergedResultsCount).length) {
      const total = Object.values(mergedResultsCount).reduce((sum, count) => sum + count, 0);
      combinedResponse.logs.push(
        new LogEntry(
          'INFO',
          null,
          `(${total}) inferred-template results were merged into (${
            Object.keys(mergedResultsCount).length
          }) final results.`,
        ).getLog(),
      );
    }
    if (successfulQueries) {
      parent.getSummaryLog(combinedResponse, combinedResponse.logs, resultQueries).forEach((log) => combinedResponse.logs.push(log));
      let scoredResults = 0;
      let unscoredResults = 0;
      combinedResponse.message.results.forEach((result) => {
        if (result.score > 0) {
          scoredResults += 1;
        } else {
          unscoredResults += 1;
        }
      });
      combinedResponse.logs.push(
        new LogEntry(
          'INFO',
          null,
          `Scoring Summary: (${scoredResults}) scored / (${unscoredResults}) unscored`,
        ).getLog(),
      );
    }
    combinedResponse.logs = combinedResponse.logs.map((log) => log.toJSON());

    return combinedResponse;
}
