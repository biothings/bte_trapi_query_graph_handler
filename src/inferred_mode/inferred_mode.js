const debug = require('debug')('bte:biothings-explorer-trapi:inferred-mode');
const LogEntry = require('../log_entry');
const utils = require('../utils');
const async = require('async');
const biolink = require('../biolink');
const { getTemplates } = require('./template_lookup');
const { addNormalizedScores } = require('../results_assembly/score');

module.exports = class InferredQueryHandler {
  constructor(parent, TRAPIQueryHandler, queryGraph, logs, options, path, predicatePath, includeReasoner) {
    this.parent = parent;
    this.TRAPIQueryHandler = TRAPIQueryHandler;
    this.queryGraph = queryGraph;
    this.logs = logs;
    this.options = options;
    this.path = path;
    this.predicatePath = predicatePath;
    this.includeReasoner = includeReasoner;
    this.CREATIVE_LIMIT = 500;
  }

  get queryIsValid() {
    const nodeMissingCategory = Object.values(this.queryGraph.nodes).some((node) => {
      return !node.categories || node.categories.length === 0;
    });
    if (nodeMissingCategory) {
      const message = 'All nodes in Inferred Mode edge must have categories. Your query terminates.';
      this.logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    const nodeMissingID = !Object.values(this.queryGraph.nodes).some((node) => {
      return node.ids && node.ids.length > 0;
    });
    if (nodeMissingID) {
      const message = 'At least one node in Inferred Mode edge must have at least 1 ID. Your query terminates.';
      this.logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    const edgeMissingPredicate =
      !Object.values(this.queryGraph.edges)[0].predicates ||
      Object.values(this.queryGraph.edges)[0].predicates.length < 1;
    if (edgeMissingPredicate) {
      const message = 'Inferred Mode edge must specify a predicate. Your query terminates.';
      this.logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    const tooManyIDs =
      1 <
      Object.values(this.queryGraph.nodes).reduce((sum, node) => {
        return typeof node.ids !== 'undefined' ? sum + node.ids.length : sum;
      }, 0);
    if (tooManyIDs) {
      const message = 'Inferred Mode queries with multiple IDs are not supported. Your query terminates.';
      this.logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    const multiplePredicates =
      Object.values(this.queryGraph.edges).reduce((sum, edge) => {
        return edge.predicates ? sum + edge.predicates.length : sum;
      }, 0) > 1;
    if (multiplePredicates) {
      const message = 'Inferred Mode queries with multiple predicates are not supported. Your query terminates.';
      this.logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    if (this.options.smartAPIID || this.options.teamName) {
      const message = 'Inferred Mode on smartapi/team-specific endpoints not supported. Your query terminates.';
      this.logs.push(new LogEntry('WARNING', null, message).getLog());
      debug(message);
      return;
    }

    return true;
  }

  getQueryParts() {
    const qEdgeID = Object.keys(this.queryGraph.edges)[0];
    const qEdge = this.queryGraph.edges[qEdgeID];
    const qSubject = this.queryGraph.nodes[qEdge.subject];
    const qObject = this.queryGraph.nodes[qEdge.object];
    return {
      qEdgeID: qEdgeID,
      qEdge: qEdge,
      qSubject: qSubject,
      qObject: qObject,
    };
  }

  async findTemplates(qEdge, qSubject, qObject) {
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
    const qualifierConstraints = (qEdge.qualifier_constraints || []).map((qualifierSetObj) => {
      return Object.fromEntries(
        qualifierSetObj.qualifier_set.map(({ qualifier_type_id, qualifier_value }) => [
          qualifier_type_id.replace('biolink:', ''),
          qualifier_value.replace('biolink:', ''),
        ]),
      );
    });
    if (qualifierConstraints.length === 0) qualifierConstraints.push({});
    const lookupObjects = expandedSubject.reduce((arr, subjectCategory) => {
      let templates = expandedObject.reduce((arr2, objectCategory) => {
        let templates2 = qualifierConstraints.reduce((arr3, qualifierSet) => {
          return [
            ...arr3,
            ...expandedPredicates.map((predicate) => {
              return {
                subject: utils.removeBioLinkPrefix(subjectCategory),
                object: utils.removeBioLinkPrefix(objectCategory),
                predicate: utils.removeBioLinkPrefix(predicate),
                qualifiers: qualifierSet,
              };
            }),
          ];
        }, []);
        return [...arr2, ...templates2];
      }, []);
      return [...arr, ...templates];
    }, []);
    const templates = await getTemplates(lookupObjects);

    const logMessage = `Got ${templates.length} inferred query templates.`;
    debug(logMessage);
    this.logs.push(new LogEntry('INFO', null, logMessage).getLog());

    if (!templates.length) {
      const logMessage = `No Templates matched your inferred-mode query. Your query terminates.`;
      debug(logMessage);
      this.logs.push(new LogEntry('WARNING', null, logMessage).getLog());
    }

    return templates;
  }

  async createQueries(qEdge, qSubject, qObject) {
    const templates = await this.findTemplates(qEdge, qSubject, qObject);
    // combine creative query with templates
    const subQueries = templates.map(({template, queryGraph}) => {
      queryGraph.nodes.creativeQuerySubject.categories = [
        ...new Set([...queryGraph.nodes.creativeQuerySubject.categories, ...qSubject.categories]),
      ];
      const creativeQuerySubjectIDs = qSubject.ids ? qSubject.ids : [];
      queryGraph.nodes.creativeQuerySubject.ids = queryGraph.nodes.creativeQuerySubject.ids
        ? [...new Set([...queryGraph.nodes.creativeQuerySubject.ids, ...creativeQuerySubjectIDs])]
        : creativeQuerySubjectIDs;

      queryGraph.nodes.creativeQueryObject.categories = [
        ...new Set([...queryGraph.nodes.creativeQueryObject.categories, ...qObject.categories]),
      ];
      const qEdgeObjectIDs = qObject.ids ? qObject.ids : [];
      queryGraph.nodes.creativeQueryObject.ids = queryGraph.nodes.creativeQueryObject.ids
        ? [...new Set([...queryGraph.nodes.creativeQueryObject.ids, ...qEdgeObjectIDs])]
        : qEdgeObjectIDs;

      if (!queryGraph.nodes.creativeQuerySubject.categories.length) {
        delete queryGraph.nodes.creativeQuerySubject.categories;
      }
      if (!queryGraph.nodes.creativeQueryObject.categories.length) {
        delete queryGraph.nodes.creativeQueryObject.categories;
      }
      if (!queryGraph.nodes.creativeQuerySubject.ids.length) {
        delete queryGraph.nodes.creativeQuerySubject.ids;
      }
      if (!queryGraph.nodes.creativeQueryObject.ids.length) {
        delete queryGraph.nodes.creativeQueryObject.ids;
      }

      return {template, queryGraph};
    });

    return subQueries;
  }

  combineResponse(queryNum, handler, qEdge, combinedResponse, reservedIDs) {
    const newResponse = handler.getResponse();
    const report = {
      querySuccess: 0,
      queryHadResults: false,
      mergedResults: {},
      creativeLimitHit: false,
    };
    let mergedThisTemplate = 0;
    const resultIDsFromPrevious = new Set(Object.keys(combinedResponse.message.results));
    // add non-duplicate nodes
    Object.entries(newResponse.message.knowledge_graph.nodes).forEach(([curie, node]) => {
      if (!(curie in combinedResponse.message.knowledge_graph.nodes)) {
        combinedResponse.message.knowledge_graph.nodes[curie] = node;
      }
    });
    // add non-duplicate edges
    Object.entries(newResponse.message.knowledge_graph.edges).forEach(([recordHash, edge]) => {
      if (!(recordHash in combinedResponse.message.knowledge_graph.edges)) {
        combinedResponse.message.knowledge_graph.edges[recordHash] = edge;
      }
    });
    // make unique node/edge ids for this sub-query's graph
    const nodeMapping = Object.fromEntries(
      Object.keys(newResponse.message.query_graph.nodes).map((nodeID) => {
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
      Object.keys(newResponse.message.query_graph.edges).map((edgeID) => {
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
    newResponse.message.results.forEach((result) => {
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
        report.mergedResults[resultID] = report.mergedResults[resultID] ? report.mergedResults[resultID] + 1 : 1;
        mergedThisTemplate += 1;
        Object.entries(translatedResult.node_bindings).forEach(([nodeID, bindings]) => {
          combinedResponse.message.results[resultID].node_bindings[nodeID] = bindings;
        });
        Object.entries(translatedResult.edge_bindings).forEach(([edgeID, bindings]) => {
          combinedResponse.message.results[resultID].edge_bindings[edgeID] = bindings;
        });

        const resScore = translatedResult.score;
        if (typeof combinedResponse.message.results[resultID].score !== 'undefined') {
          combinedResponse.message.results[resultID].score = resScore
            ? Math.max(combinedResponse.message.results[resultID].score, resScore)
            : combinedResponse.message.results[resultID].score;
        } else {
          combinedResponse.message.results[resultID].score = resScore;
        }
      } else {
        combinedResponse.message.results[resultID] = translatedResult;
      }
    });
    const mergedWithinTemplate = Object.entries(report.mergedResults).reduce((count, [resultID, merged]) => {
      return !resultIDsFromPrevious.has(resultID) ? count + merged : count;
    }, 0)

    // fix/combine logs
    handler.logs.forEach((log) => {
      Object.entries(nodeMapping).forEach(([oldID, newID]) => {
        log.message = log.message.replace(oldID, newID);
      });
      Object.entries(edgeMapping).forEach(([oldID, newID]) => {
        log.message = log.message.replace(oldID, newID);
      });
      log.message = `[Template-${queryNum + 1}]: ${log.message}`;

      combinedResponse.logs.push(log);
    });

    const mergeMessage = [
      `(${mergedWithinTemplate}) results from Template-${queryNum + 1} `,
      `were merged with other results from the template. `,
      `(${mergedThisTemplate - mergedWithinTemplate}) results `,
      `were merged with existing results from previous templates. `,
      `Current result count is ${Object.keys(combinedResponse.message.results).length} `,
      `(+${newResponse.message.results.length - mergedThisTemplate})`
    ].join('');
    debug(mergeMessage);
    combinedResponse.logs.push(new LogEntry('INFO', null, mergeMessage).getLog());

    if (newResponse.message.results.length) {
      report.queryHadResults = true;
    }
    report.querySuccess = 1;

    if (Object.keys(combinedResponse.message.results).length >= this.CREATIVE_LIMIT && !report.creativeLimitHit) {
      report.creativeLimitHit = Object.keys(newResponse.message.results).length;
    }
    return report;
  }

  pruneKnowledgeGraph(combinedResponse) {
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
  }

  async query() {
    // TODO [POST-MVP] check for flipped predicate cases
    // e.g. Drug -treats-> Disease OR Disease -treated_by-> Drug
    let logMessage = 'Query proceeding in Inferred Mode.';
    debug(logMessage);
    this.logs.push(new LogEntry('INFO', null, logMessage).getLog());

    if (!this.queryIsValid) {
      return;
    }

    const { qEdgeID, qEdge, qSubject, qObject } = this.getQueryParts();
    const subQueries = await this.createQueries(qEdge, qSubject, qObject);
    const combinedResponse = {
      workflow: [{ id: 'lookup' }],
      message: {
        query_graph: this.queryGraph,
        knowledge_graph: {
          nodes: {},
          edges: {},
        },
        results: {},
      },
      logs: this.logs,
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

    await async.eachOfSeries(subQueries, async ({template, queryGraph}, i) => {
      if (stop) {
        return;
      }
      if (global.queryInformation?.queryGraph) {
        global.queryInformation.isCreativeMode = true;
        global.queryInformation.creativeTemplate = template;
      }
      const handler = new this.TRAPIQueryHandler(this.options, this.path, this.predicatePath, this.includeReasoner);
      try {
        // make query and combine results/kg/logs/etc
        handler.setQueryGraph(queryGraph);
        await handler.query();
        const { querySuccess, queryHadResults, mergedResults, creativeLimitHit } = this.combineResponse(
          i,
          handler,
          qEdge,
          combinedResponse,
          reservedIDs,
        );
        // update values used in logging
        successfulQueries += querySuccess;
        if (queryHadResults) resultQueries.push(i);
        Object.entries(mergedResults).forEach(([result, countMerged]) => {
          mergedResultsCount[result] =
            result in mergedResultsCount ? mergedResultsCount[result] + countMerged : countMerged;
        });
        // log to user if we should stop
        if (creativeLimitHit) {
          stop = true;
          const message = [
            `Addition of ${creativeLimitHit} results from Template ${i + 1}`,
            Object.keys(combinedResponse.message.results).length === this.CREATIVE_LIMIT ? ' meets ' : ' exceeds ',
            `creative result maximum of ${this.CREATIVE_LIMIT} (reaching ${
              Object.keys(combinedResponse.message.results).length
            } merged). `,
            `Response will be truncated to top-scoring ${this.CREATIVE_LIMIT} results. Skipping remaining ${
              subQueries.length - (i + 1)
            } `,
            subQueries.length - (i + 1) === 1 ? `template.` : `templates.`,
          ].join('');
          debug(message);
          combinedResponse.logs.push(new LogEntry(`INFO`, null, message).getLog());
        }
      } catch (error) {
        handler.logs.forEach((log) => {
          combinedResponse.logs.push(log);
        });
        const message = `ERROR:  Template-${i + 1} failed due to error ${error}`;
        debug(message);
        combinedResponse.logs.push(new LogEntry(`ERROR`, null, message).getLog());
        return;
      }
    });
    // log about merged Results
    if (Object.keys(mergedResultsCount).length) {
      // Add 1 for first instance of result (not counted during merging)
      const total = Object.values(mergedResultsCount).reduce((sum, count) => sum + count, 0) + Object.keys(mergedResultsCount).length;
      const message = `Merging Summary: (${total}) inferred-template results were merged into (${
        Object.keys(mergedResultsCount).length
      }) final results, reducing result count by (${total - Object.keys(mergedResultsCount).length})`;
      debug(message);
      combinedResponse.logs.push(
        new LogEntry(
          'INFO',
          null,
          message,
        ).getLog(),
      );
    }
    if (Object.keys(combinedResponse.message.results).length) {
      combinedResponse.logs.push(
        new LogEntry(
          'INFO',
          null,
          [
            `Final result count`,
            Object.keys(combinedResponse.message.results).length > this.CREATIVE_LIMIT
              ? " (before truncation):" : ":",
            ` ${Object.keys(combinedResponse.message.results).length}`
          ].join('')
        ).getLog()
      )
    }
    // sort records by score
    combinedResponse.message.results = Object.values(combinedResponse.message.results).sort((a, b) => {
      return b.score - a.score ? b.score - a.score : 0;
    });
    // trim extra results and prune kg
    combinedResponse.message.results = combinedResponse.message.results.slice(0, this.CREATIVE_LIMIT);
    this.pruneKnowledgeGraph(combinedResponse);
    // get the final summary log
    if (successfulQueries) {

      this.parent
        .getSummaryLog(combinedResponse, combinedResponse.logs, resultQueries)
        .forEach((log) => combinedResponse.logs.push(log));
      let scoredResults = 0;
      let unscoredResults = 0;
      combinedResponse.message.results.forEach((result) => {
        const scoreFromEdges = Object.values(result.edge_bindings).reduce((count, qEdge_bindings) => {
          return count + qEdge_bindings.length;
        }, 0);
        if (result.score > scoreFromEdges) {
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
};
