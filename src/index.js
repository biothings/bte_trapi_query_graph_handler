const meta_kg = require('@biothings-explorer/smartapi-kg');
var path = require('path');
const BatchEdgeQueryHandler = require('./batch_edge_query');
const QueryGraph = require('./query_graph');
const KnowledgeGraph = require('./graph/knowledge_graph');
const TrapiResultsAssembler = require('./query_results');
const InvalidQueryGraphError = require('./exceptions/invalid_query_graph_error');
const debug = require('debug')('bte:biothings-explorer-trapi:main');
const Graph = require('./graph/graph');
const EdgeManager = require('./edge_manager');
const _ = require('lodash');
const QEdge2APIEdgeHandler = require('./qedge2apiedge');
const LogEntry = require('./log_entry');
const { redisClient } = require('./redis-client');
const config = require('./config');
const fs = require('fs').promises;
const { getTemplates } = require('./template_lookup');
const utils = require('./utils');
const async = require('async');

exports.InvalidQueryGraphError = InvalidQueryGraphError;
exports.redisClient = redisClient;
exports.LogEntry = LogEntry;

exports.TRAPIQueryHandler = class TRAPIQueryHandler {
  constructor(options = {}, smartAPIPath = undefined, predicatesPath = undefined, includeReasoner = true) {
    this.logs = [];
    this.options = options;
    this.includeReasoner = includeReasoner;
    this.resolveOutputIDs =
      typeof this.options.enableIDResolution === 'undefined' ? true : this.options.enableIDResolution;
    this.path = smartAPIPath || path.resolve(__dirname, './smartapi_specs.json');
    this.predicatePath = predicatesPath || path.resolve(__dirname, './predicates.json');
  }

  _loadMetaKG() {
    const metaKG = new meta_kg.default(this.path, this.predicatePath);
    debug(`Query options are: ${JSON.stringify(this.options)}`);
    debug(`SmartAPI Specs read from path: ${this.path}`);
    metaKG.constructMetaKGSync(this.includeReasoner, this.options);
    return metaKG;
  }

  getResponse() {
    return {
      workflow: [{ id: 'lookup' }],
      message: {
        query_graph: this.queryGraph,
        knowledge_graph: this.knowledgeGraph.kg,
        results: this.trapiResultsAssembler.getResults(),
      },
      logs: this.logs.map((log) => log.toJSON()),
    };
  }

  /**
   * Set TRAPI Query Graph
   * @param {object} queryGraph - TRAPI Query Graph Object
   */
  setQueryGraph(queryGraph) {
    for (const nodeId in queryGraph.nodes) {
      if (Object.hasOwnProperty.call(queryGraph.nodes, nodeId)) {
        const currentNode = queryGraph.nodes[nodeId];
        if (Object.hasOwnProperty.call(currentNode, 'categories')) {
          if (
            currentNode['categories'].includes('biolink:Protein') &&
            !currentNode['categories'].includes('biolink:Gene')
          ) {
            debug(`(0) Adding "Gene" category to "Protein" node.`);
            currentNode['categories'].push('biolink:Gene');
          }
        }
      }
    }
    this.queryGraph = queryGraph;
  }

  _initializeResponse() {
    this.knowledgeGraph = new KnowledgeGraph();
    this.trapiResultsAssembler = new TrapiResultsAssembler();
    this.bteGraph = new Graph();
    this.bteGraph.subscribe(this.knowledgeGraph);
  }

  /**
   * @private
   * @param {object} queryGraph - TRAPI Query Graph Object
   */
  async _processQueryGraph(queryGraph) {
    try {
      let queryGraphHandler = new QueryGraph(queryGraph);
      let queryExecutionEdges = await queryGraphHandler.calculateEdges();
      this.logs = [...this.logs, ...queryGraphHandler.logs];
      return queryExecutionEdges;
    } catch (err) {
      if (err instanceof InvalidQueryGraphError) {
        throw err;
      } else {
        throw new InvalidQueryGraphError();
      }
    }
  }

  _createBatchEdgeQueryHandlersForCurrent(currentQXEdge, metaKG) {
    let handler = new BatchEdgeQueryHandler(metaKG, this.resolveOutputIDs, {
      caching: this.options.caching,
      recordHashEdgeAttributes: config.EDGE_ATTRIBUTES_USED_IN_RECORD_HASH,
    });
    handler.setEdges(currentQXEdge);
    return handler;
  }

  async _edgesSupported(qXEdges, metaKG) {
    if (this.options.dryrun) {
      let log_msg =
        'Running dryrun of query, no API calls will be performed. Actual query execution order may vary based on API responses received.';
      this.logs.push(new LogEntry('INFO', null, log_msg).getLog());
    }

    // _.cloneDeep() is resource-intensive but only runs once per query
    qXEdges = _.cloneDeep(qXEdges);
    const manager = new EdgeManager(qXEdges);
    const qEdgesMissingOps = {};
    while (manager.getEdgesNotExecuted()) {
      let currentQXEdge = manager.getNext();
      const edgeConverter = new QEdge2APIEdgeHandler([currentQXEdge], metaKG);
      const metaXEdges = edgeConverter.getMetaXEdges(currentQXEdge);

      if (this.options.dryrun) {
        let apiNames = [...new Set(metaXEdges.map((metaXEdge) => metaXEdge.association.api_name))];

        let log_msg;
        if (currentQXEdge.reverse) {
          log_msg = `qEdge ${currentQXEdge.qEdge.id} (reversed): ${currentQXEdge.qEdge.object.category} > ${
            currentQXEdge.qEdge.predicate ? `${currentQXEdge.qEdge.predicate} > ` : ''
          }${currentQXEdge.qEdge.subject.category}`;
        } else {
          log_msg = `qEdge ${currentQXEdge.qEdge.id}: ${currentQXEdge.qEdge.subject.category} > ${
            currentQXEdge.qEdge.predicate ? `${currentQXEdge.qEdge.predicate} > ` : ''
          }${currentQXEdge.qEdge.object.category}`;
        }
        this.logs.push(new LogEntry('INFO', null, log_msg).getLog());

        if (metaXEdges.length) {
          let log_msg_2 = `${metaXEdges.length} total planned queries to following APIs: ${apiNames.join(',')}`;
          this.logs.push(new LogEntry('INFO', null, log_msg_2).getLog());
        }

        metaXEdges.forEach((metaXEdge) => {
          log_msg = `${metaXEdge.association.api_name}: ${metaXEdge.association.input_type} > ${metaXEdge.association.predicate} > ${metaXEdge.association.output_type}`;
          this.logs.push(new LogEntry('DEBUG', null, log_msg).getLog());
        });
      }

      if (!metaXEdges.length) {
        qEdgesMissingOps[currentQXEdge.qEdge.id] = currentQXEdge.reverse;
      }
      // assume results so next edge may be reversed or not
      currentQXEdge.executed = true;

      //use # of APIs as estimate of # of records
      if (metaXEdges.length) {
        if (currentQXEdge.reverse) {
          currentQXEdge.subject.entity_count = currentQXEdge.object.entity_count * metaXEdges.length;
        } else {
          currentQXEdge.object.entity_count = currentQXEdge.subject.entity_count * metaXEdges.length;
        }
      } else {
        currentQXEdge.object.entity_count = 1;
        currentQXEdge.subject.entity_count = 1;
      }
    }

    const len = Object.keys(qEdgesMissingOps).length;
    // this.logs = [...this.logs, ...manager.logs];
    let qEdgesToLog = Object.entries(qEdgesMissingOps).map(([qEdge, reversed]) => {
      return reversed ? `(reversed ${qEdge})` : `(${qEdge})`;
    });
    qEdgesToLog = qEdgesToLog.length > 1 ? `[${qEdgesToLog.join(', ')}]` : `${qEdgesToLog.join(', ')}`;
    if (len > 0) {
      const terminateLog = `Query Edge${len !== 1 ? 's' : ''} ${qEdgesToLog} ${
        len !== 1 ? 'have' : 'has'
      } no MetaKG edges. Your query terminates.`;
      debug(terminateLog);
      this.logs.push(new LogEntry('WARNING', null, terminateLog).getLog());
      return false;
    } else {
      if (this.options.dryrun) {
        return false;
      }
      return true;
    }
  }

  async _logSkippedQueries(unavailableAPIs) {
    Object.entries(unavailableAPIs).forEach(([api, skippedQueries]) => {
      skippedQueries -= 1; // first failed is not 'skipped'
      if (skippedQueries > 0) {
        const skipMessage = `${skippedQueries} additional quer${skippedQueries > 1 ? 'ies' : 'y'} to ${api} ${
          skippedQueries > 1 ? 'were' : 'was'
        } skipped as the API was unavailable.`;
        debug(skipMessage);
        this.logs.push(new LogEntry('WARNING', null, skipMessage).getLog());
      }
    });
  }

  async dumpRecords(records) {
    let filePath = path.resolve('../../..', process.env.DUMP_RECORDS);
    // create new (unique) file if arg is directory
    try {
      if ((await fs.lstat(filePath)).isDirectory()) {
        filePath = path.resolve(filePath, `recordDump-${new Date().toISOString()}.json`);
      }
    } catch (e) {
      null; // specified a file, which doesn't exist (which is fine)
    }
    let direction = false;
    if (process.env.DUMP_RECORDS_DIRECTION?.includes('exec')) {
      direction = true;
      records = [...records].map((record) => record.queryDirection());
    }
    await fs.writeFile(filePath, JSON.stringify(records.map((record) => record.freeze())));
    let logMessage = `Dumping Records ${direction ? `(in execution direction)` : ''} to ${filePath}`;
    debug(logMessage);
  }

  _queryUsesInferredMode() {
    const inferredEdge = Object.values(this.queryGraph.edges).some((edge) => edge.knowledge_type === 'inferred');

    return inferredEdge;
  }

  _queryIsOneHop() {
    const oneHop = Object.keys(this.queryGraph.edges).length === 1;
    return oneHop;
  }

  async _handleInferredEdges(usePredicate = true) {
    // TODO [POST-MVP] check for flipped predicate cases
    // i.e. Drug -treats-> Disease OR Disease -treated_by-> Drug
    // TODO [POST MVP] possibly do biolink subclass expansion
    // i.e. Drug -treats-> DiseaseOrPhenoTypicFeature
    // also adds Drug -treats-> Disease & Drug -treats->PhenotypicFeature
    let logMessage = 'Query proceeding in Inferred Mode';
    debug(logMessage);
    this.logs.push(new LogEntry('INFO', null, logMessage).getLog());

    const nodeMissingCategory = Object.values(this.queryGraph.nodes).some((node) => {
      return typeof node.categories === 'undefined' || node.categories.length === 0;
    });
    if (nodeMissingCategory) {
      const message = 'All nodes in Inferred Mode edge must have categories. Your query terminates.';
      this.logs.push(new LogEntry("ERROR", null, message).getLog());
      debug(message);
      return;
    }

    const nodeMissingID = !Object.values(this.queryGraph.nodes).some((node) => {
      return typeof node.ids !== 'undefined' && node.ids.length > 0;
    })
    if (nodeMissingID) {
      const message = 'At least one node in Inferred Mode edge must have at least 1 ID. Your query terminates.';
      this.logs.push(new LogEntry("ERROR", null, message).getLog());
      debug(message);
      return;
    }

    const qEdgeID = Object.keys(this.queryGraph.edges)[0];
    const qEdge = this.queryGraph.edges[qEdgeID];
    const qSubject = this.queryGraph.nodes[qEdge.subject];
    const qObject = this.queryGraph.nodes[qEdge.object];
    debug('Looking up query Templates');
    const searchStrings = qSubject.categories.reduce((arr, subCat) => {
      let templates;
      if (usePredicate) {
        templates = qObject.categories.reduce((arr2, objCat) => {
          return [
            ...arr2,
            ...qEdge.predicates.map((predicate) => {
              return `${utils.removeBioLinkPrefix(subCat)}-${utils.removeBioLinkPrefix(
                predicate,
              )}-${utils.removeBioLinkPrefix(objCat)}`;
            }),
          ];
        }, []);
      } else {
        return qObject.categories.map((objCat) => {
          return `${utils.removeBioLinkPrefixs(subCat)}-${utils.removeBioLinkPrefix(objCat)}`;
        });
      }
      return [...arr, ...templates];
    }, []);
    const templates = await getTemplates(searchStrings);

    logMessage = `Got ${templates.length} inferred query templates`;
    debug(logMessage);
    this.logs.push(new LogEntry('INFO', null, logMessage).getLog());

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
        results: [],
      },
      logs: this.logs,
    };
    const reservedIDs = {
      nodes: [qEdge.subject, qEdge.object],
      edges: [qEdgeID],
    };
    // add/combine nodes
    let successfulQueries = 0;
    await async.eachOfSeries(subQueries, async (queryGraph, i) => {
      const handler = new TRAPIQueryHandler(this.options, this.path, this.predicatePath, this.includeReasoner);
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
            if (['subject', 'object'].includes(nodeID)) {
              newID === 'subject' ? qEdge.subject : qEdge.object;
            } else {
              while (reservedIDs.nodes.includes(newID)) {
                let number = newID.match(/[0-9]+$/);
                let newNumber = number ? `0${parseInt(number[0]) + 1}` : '01';
                newID = number
                  ? newID.replace(number, newNumber)
                  : `${newID}${newNumber}`;
              }
              reservedIDs.nodes.push(newID);
            }
            return [nodeID, newID];
          }),
        );
        const edgeMapping = Object.fromEntries(
          Object.keys(response.message.query_graph.edges).map((edgeID) => {
            let newID = edgeID;
            if (['subject', 'object'].includes(edgeID)) {
              newID === 'subject' ? qEdge.subject : qEdge.object;
            } else {
              while (reservedIDs.edges.includes(newID)) {
                let number = newID.match(/[0-9]+$/);
                let newNumber = number ? `0${parseInt(number[0]) + 1}` : '01';
                newID = number
                  ? newID.replace(number, newNumber)
                  : `${newID}${newNumber}`;
              }
              reservedIDs.edges.push(newID);
            }
            return [edgeID, newID];
          }),
        );
        // add results
        response.message.results.forEach((result) => {
          const translatedResult = {
            node_bindings: {},
            edge_bindings: {},
            score: 0,
          };
          Object.entries(result.node_bindings).forEach(([nodeID, bindings]) => {
            translatedResult.node_bindings[nodeMapping[nodeID]] = bindings;
          });
          Object.entries(result.edge_bindings).forEach(([edgeID, bindings]) => {
            translatedResult.edge_bindings[edgeMapping[edgeID]] = bindings;
          });
          combinedResponse.message.results.push(translatedResult);
        });
        // fix/combine logs
        handler.logs.forEach((log) => {
          Object.entries(nodeMapping).forEach(([oldID, newID]) => {
            log.message = log.message.replace(oldID, newID);
          });
          Object.entries(edgeMapping).forEach(([oldID, newID]) => {
            log.message = log.message.replace(oldID, newID);
          });
          log.message = `[SubQuery-${i}]: ${log.message}`;

          combinedResponse.logs.push(log);
        });
        if (response.message.results.length) {
          successfulQueries += 1;
        }
      } catch (error) {
        handler.logs.forEach((log) => {
          combinedResponse.logs.push(log);
        })
        const message = `ERROR: subQuery ${i} failed due to error ${error}`;
        debug(message);
        this.logs.push(new LogEntry(`ERROR`, null, message).getLog());
        return;
      }
    });
    combinedResponse.message.query_graph = this.queryGraph;

    this.getResponse = () => {
      return combinedResponse;
    };
    if (successfulQueries > 0) {
      this.createSummaryLog(combinedResponse.logs).forEach((log) => combinedResponse.logs.push(log));
    }
    combinedResponse.logs = combinedResponse.logs.map((log) => log.toJSON());
  }

  createSummaryLog(logs) {
    const response = this.getResponse();
    const KGNodes = Object.keys(response.message.knowledge_graph.nodes).length;
    const kgEdges = Object.keys(response.message.knowledge_graph.edges).length;
    const results = response.message.results.length;
    const resultQueries = logs.filter(({ data }) => data?.type === 'query' && data?.hits).length;
    const queries = logs.filter(({ data }) => data?.type === 'query').length;
    const sources = [...new Set(logs.filter(({ data }) => data?.type === 'query').map(({ data }) => data?.api_name))];
    let cached = logs.filter(({ data }) => data?.type === 'cacheHit').length;
    return [
      new LogEntry(
        'INFO',
        null,
        `Execution Summary: (${KGNodes}) nodes / (${kgEdges}) edges / (${results}) results; (${resultQueries}/${queries}) queries${
          cached ? ` (${cached} cached qEdges)` : ''
        } returned results from (${sources.length}) unique APIs ${sources === 1 ? 's' : ''}`,
      ).getLog(),
      new LogEntry('INFO', null, `APIs: ${sources.join(', ')}`).getLog(),
    ];
  }

  async query() {
    this._initializeResponse();
    debug('Start to load metakg.');
    const metaKG = this._loadMetaKG(this.smartapiID, this.team);
    if (!metaKG.ops.length) {
      let error;
      if (this.options.smartapiID) {
        error = `Specified SmartAPI ID (${this.options.smartAPIID}) is either invalid or missing.`;
      } else if (this.options.teamName) {
        error = `Specified Team (${this.options.teamName}) is either invalid or missing.`;
      } else {
        error = `Something has gone wrong and the MetaKG is empty. Please try again later. If this persists, please contact the server admin.`;
      }
      this.logs.push(new LogEntry('ERROR', null, error).getLog());
    }
    debug('MetaKG successfully loaded!');
    if (global.missingAPIs) {
      this.logs.push(
        new LogEntry(
          'WARNING',
          null,
          `The following APIs were unavailable at the time of execution: ${global.missingAPIs
            .map((spec) => spec.info.title)
            .join(', ')}`,
        ).getLog(),
      );
    }
    let queryExecutionEdges = await this._processQueryGraph(this.queryGraph);
    debug(`(3) All edges created ${JSON.stringify(queryExecutionEdges)}`);
    if (this._queryUsesInferredMode() && this._queryIsOneHop()) {
      await this._handleInferredEdges();
      return;
    } else if (this._queryUsesInferredMode && !this._queryIsOneHop) {
      const message = "Inferred Mode edges are only supported in single-edge queries. Your query terminates."
      debug(message);
      this.logs.push(new LogEntry("ERROR", null, message));
      return;
    }
    if (!(await this._edgesSupported(queryExecutionEdges, metaKG))) {
      return;
    }
    const manager = new EdgeManager(queryExecutionEdges);
    const unavailableAPIs = {};
    while (manager.getEdgesNotExecuted()) {
      //next available/most efficient edge
      let currentQXEdge = manager.getNext();
      //crate queries from edge
      let handler = this._createBatchEdgeQueryHandlersForCurrent(currentQXEdge, metaKG);
      this.logs.push(
        new LogEntry(
          'INFO',
          null,
          `Executing ${currentQXEdge.getID()}${currentQXEdge.isReversed() ? ' (reversed)' : ''}: ${
            currentQXEdge.subject.id
          } ${currentQXEdge.isReversed() ? '<--' : '-->'} ${currentQXEdge.object.id}`,
        ).getLog(),
      );
      debug(`(5) Executing current edge >> "${currentQXEdge.getID()}"`);
      //execute current edge query
      let queryRecords = await handler.query(handler.qXEdges, unavailableAPIs);
      this.logs = [...this.logs, ...handler.logs];
      // create an edge execution summary
      let success = 0,
        fail = 0,
        total = 0;
      let cached = this.logs.filter(
        ({ data }) => data?.qEdgeID === currentQXEdge.qEdge.id && data?.type === 'cacheHit',
      ).length;
      this.logs
        .filter(({ data }) => data?.qEdgeID === currentQXEdge.qEdge.id && data?.type === 'query')
        .forEach(({ data }) => {
          !data.error ? success++ : fail++;
          total++;
        });
      this.logs.push(
        new LogEntry(
          'INFO',
          null,
          `${currentQXEdge.qEdge.id} execution: ${total} queries (${success} success/${fail} fail) and (${cached}) cached qEdges return (${queryRecords.length}) records`,
          {},
        ).getLog(),
      );
      if (queryRecords.length === 0) {
        this._logSkippedQueries(unavailableAPIs);
        debug(`(X) Terminating..."${currentQXEdge.getID()}" got 0 records.`);
        this.logs.push(
          new LogEntry(
            'WARNING',
            null,
            `qEdge (${currentQXEdge.getID()}) got 0 records. Your query terminates.`,
          ).getLog(),
        );
        return;
      }
      //storing records will trigger a node entity count update
      currentQXEdge.storeRecords(queryRecords);
      //filter records
      manager.updateEdgeRecords(currentQXEdge);
      //update and filter neighbors
      manager.updateAllOtherEdges(currentQXEdge);
      // check that any records are kept
      if (!currentQXEdge.records.length) {
        this._logSkippedQueries(unavailableAPIs);
        debug(`(X) Terminating..."${currentQXEdge.getID()}" kept 0 records.`);
        this.logs.push(
          new LogEntry(
            'WARNING',
            null,
            `qEdge (${currentQXEdge.getID()}) kept 0 records. Your query terminates.`,
          ).getLog(),
        );
        return;
      }
      // edge all done
      currentQXEdge.executed = true;
      debug(`(10) Edge successfully queried.`);
    }
    this._logSkippedQueries(unavailableAPIs);
    // collect and organize records
    manager.collectRecords();
    // dump records if set to do so
    if (process.env.DUMP_RECORDS) {
      await this.dumpRecords(manager.getRecords());
    }
    this.logs = [...this.logs, ...manager.logs];
    // update query graph
    this.bteGraph.update(manager.getRecords());
    //update query results
    await this.trapiResultsAssembler.update(manager.getOrganizedRecords());
    this.logs = [...this.logs, ...this.trapiResultsAssembler.logs];
    // prune bteGraph
    this.bteGraph.prune(this.trapiResultsAssembler.getResults());
    this.bteGraph.notify();
    // finishing logs
    this.createSummaryLog(this.logs).forEach((log) => this.logs.push(log));
    debug(`(14) TRAPI query finished.`);
  }
};
