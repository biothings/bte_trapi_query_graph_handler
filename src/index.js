const meta_kg = require('@biothings-explorer/smartapi-kg');
var path = require('path');
const BatchEdgeQueryHandler = require('./batch_edge_query');
const QueryGraph = require('./query_graph');
const KnowledgeGraph = require('./graph/knowledge_graph');
const QueryResults = require('./query_results');
const InvalidQueryGraphError = require('./exceptions/invalid_query_graph_error');
const debug = require('debug')('bte:biothings-explorer-trapi:main');
const Graph = require('./graph/graph');
const EdgeManager = require('./edge_manager');
const _ = require('lodash');
const QEdge2BTEEdgeHandler = require('./qedge2bteedge');
const LogEntry = require('./log_entry');
const redisClient = require('./redis-client');

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
    const kg = new meta_kg.default(this.path, this.predicatePath);
    debug(`Query options are: ${JSON.stringify(this.options)}`);
    debug(`SmartAPI Specs read from path: ${this.path}`);
    kg.constructMetaKGSync(this.includeReasoner, this.options);
    return kg;
  }

  getResponse() {
    this.bteGraph.notify();
    return {
      workflow: [{ id: 'lookup' }],
      message: {
        query_graph: this.queryGraph,
        knowledge_graph: this.knowledgeGraph.kg,
        results: this.queryResults.getResults(),
      },
      logs: this.logs.map(log => log.toJSON()),
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
          if (currentNode['categories'].includes("biolink:Protein") &&
          !currentNode['categories'].includes("biolink:Gene")) {
            debug(`(0) Adding "Gene" category to "Protein" node.`);
            currentNode['categories'].push("biolink:Gene");
          }
        }
      }
    }
    this.queryGraph = queryGraph;
  }

  _initializeResponse() {
    this.knowledgeGraph = new KnowledgeGraph();
    this.queryResults = new QueryResults();
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
      let res = await queryGraphHandler.calculateEdges();
      this.logs = [...this.logs, ...queryGraphHandler.logs];
      return res;
    } catch (err) {
      if (err instanceof InvalidQueryGraphError) {
        throw err;
      } else {
        throw new InvalidQueryGraphError();
      }
    }
  }

  _createBatchEdgeQueryHandlers(queryPaths, kg) {
    let handlers = {};
    for (const index in queryPaths) {
      handlers[index] = new BatchEdgeQueryHandler(kg, this.resolveOutputIDs, { caching: this.options.caching });
      handlers[index].setEdges(queryPaths[index]);
      handlers[index].subscribe(this.queryResults);
      handlers[index].subscribe(this.bteGraph);
    }
    return handlers;
  }

  _createBatchEdgeQueryHandlersForCurrent(currentEdge, kg) {
    let handler = new BatchEdgeQueryHandler(kg, this.resolveOutputIDs, {caching: this.options.caching });
    handler.setEdges(currentEdge);
    return handler;
  }

  async _edgesSupported(qEdges, kg) {
    // _.cloneDeep() is resource-intensive but only runs once per query
    qEdges = _.cloneDeep(qEdges);
    const manager = new EdgeManager(qEdges);
    const edgesMissingOps = {};
    while (manager.getEdgesNotExecuted()) {
      let current_edge = manager.getNext();
      const edgeConverter = new QEdge2BTEEdgeHandler([current_edge], kg);
      const sAPIEdges = edgeConverter.getSmartAPIEdges(current_edge);

      if (this.options.dryrun) {
        let apiNames = [...new Set(sAPIEdges.map((apiEdge) => apiEdge.association.api_name))];

        let log_msg;
        if (current_edge.reverse) {
          log_msg = `Edge ${current_edge.qEdge.id} (reversed): ${current_edge.qEdge.object.category} > ${current_edge.qEdge.predicate ? `${current_edge.qEdge.predicate} > ` : ''}${current_edge.qEdge.subject.category}`;
        } else {
          log_msg = `Edge ${current_edge.qEdge.id}: ${current_edge.qEdge.subject.category} > ${current_edge.qEdge.predicate ? `${current_edge.qEdge.predicate} > ` : ''}${current_edge.qEdge.object.category}`;
        }
        this.logs.push(new LogEntry("INFO", null, log_msg).getLog());

        if (sAPIEdges.length) {
          let log_msg_2 = `${sAPIEdges.length} total planned queries to following APIs: ${apiNames.join(',')}`;
          this.logs.push(new LogEntry("INFO", null, log_msg_2).getLog());
        }

        sAPIEdges.forEach(apiEdge => {
          log_msg = `${apiEdge.association.api_name}: ${apiEdge.association.input_type} > ${apiEdge.association.predicate} > ${apiEdge.association.output_type}`;
          this.logs.push(new LogEntry("DEBUG", null, log_msg).getLog());
        });
      }

      if (!sAPIEdges.length) {
        edgesMissingOps[current_edge.qEdge.id] = current_edge.reverse;
      }
      // assume results so next edge may be reversed or not
      current_edge.executed = true;
      current_edge.object.entity_count = 1;
      current_edge.subject.entity_count = 1;
      // this.logs = [...this.logs, ...edgeConverter.logs];
    }

    const len = Object.keys(edgesMissingOps).length;
    // this.logs = [...this.logs, ...manager.logs];
    let edgesToLog = Object.entries(edgesMissingOps).map(([edge, reversed]) => {
      return reversed
        ? `(reversed ${edge})`
        : `(${edge})`;
    });
    edgesToLog = edgesToLog.length > 1
      ? `[${edgesToLog.join(', ')}]`
      : `${edgesToLog.join(', ')}`
    if (len > 0) {
      const terminateLog = `Query Edge${len !== 1 ? 's' : ''} ${edgesToLog} ${
        len !== 1 ? 'have' : 'has'
      } no SmartAPI edges. Your query terminates.`;
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

  async query() {
    this._initializeResponse();
    debug('Start to load metakg.');
    const kg = this._loadMetaKG(this.smartapiID, this.team);
    debug('MetaKG successfully loaded!');
    if (global.missingAPIs) {
      this.logs.push(
        new LogEntry(
          'WARNING',
          null,
          `The following APIs were unavailable at the time of execution: ${global.missingAPIs.map(spec => spec.info.title).join(', ')}`
        ).getLog()
      )
    }
    let queryEdges = await this._processQueryGraph(this.queryGraph);
    debug(`(3) All edges created ${JSON.stringify(queryEdges)}`);
    if (!(await this._edgesSupported(queryEdges, kg))) {
      return;
    }
    const manager = new EdgeManager(queryEdges);
    while (manager.getEdgesNotExecuted()) {
      //next available/most efficient edge
      let current_edge = manager.getNext();
      //crate queries from edge
      let handler = this._createBatchEdgeQueryHandlersForCurrent(current_edge, kg);
      this.logs.push(
        new LogEntry(
          'INFO',
          null,
          `Executing ${current_edge.getID()}${current_edge.isReversed() ? ' (reversed)' : ''}: ${
            current_edge.subject.id
          } ${current_edge.isReversed() ? '<--' : '-->'} ${
            current_edge.object.id
          }`,
        ).getLog(),
      );
      debug(`(5) Executing current edge >> "${current_edge.getID()}"`);
      //execute current edge query
      let res = await handler.query(handler.qEdges);
      this.logs = [...this.logs, ...handler.logs];
      // create an edge execution summary
      let success = 0, fail = 0, total = 0;
      let cached = this.logs.filter(({ data }) => data?.edge_id === current_edge.qEdge.id && data?.type === 'cacheHit').length;
      this.logs
        .filter(({ data }) => data?.edge_id === current_edge.qEdge.id && data?.type === 'query')
        .forEach(({ data }) => {
          !data.error ? success++ : fail++;
          total++;
        });
      this.logs.push(
        new LogEntry(
          'INFO',
          null,
          `${current_edge.qEdge.id} execution: ${total} queries (${success} success/${fail} fail) and (${cached}) cached edges return (${res.length}) hits`,
          {}
        ).getLog()
      );
      if (res.length === 0) {
        debug(`(X) Terminating..."${current_edge.getID()}" got 0 results.`);
        return;
      }
      //storing results will trigger a node entity count update
      current_edge.storeResults(res);
      //filter results
      manager.updateEdgeResults(current_edge);
      //update and filter neighbors
      manager.updateAllOtherEdges(current_edge);
      // check that any results are kept
      if (!current_edge.results.length) {
        debug(`(X) Terminating..."${current_edge.getID()}" got 0 results.`);
        this.logs.push(
            new LogEntry(
                'WARNING',
                null,
                `Edge (${current_edge.getID()}) kept 0 results. Your query terminates.`
            ).getLog()
        );
        return;
    }
      //edge all done
      current_edge.executed = true;
      debug(`(10) Edge successfully queried.`);
    };
    //collect and organize results
    manager.collectResults();
    this.logs = [...this.logs, ...manager.logs];
    //update query graph
    this.bteGraph.update(manager.getResults());
    //update query results
    this.queryResults.update(manager.getOrganizedResults());
    this.bteGraph.notify();
    const nodes = Object.keys(this.knowledgeGraph.nodes).length;
    const edges = Object.keys(this.knowledgeGraph.edges).length;
    const results = this.queryResults.getResults().length;
    const resultQueries = this.logs.filter(({ data }) => data?.type === 'query' && data?.hits).length;
    const queries = this.logs.filter(({ data }) => data?.type === 'query').length;
    const sources = [...new Set(manager.results.map(res => res.$edge_metadata.api_name))];
    let cached = this.logs.filter(({ data }) => data?.type === 'cacheHit').length;
    this.logs.push(
      new LogEntry(
        'INFO',
        null,
        `Execution Summary: (${nodes}) nodes / (${edges}) edges / (${results}) results; (${resultQueries}/${queries}) queries${cached ? ` (${cached} cached edges)` : ''} returned results from (${sources.length}) unique APIs ${
          sources === 1 ? 's' : ''
        }`,
      ).getLog(),
    );
    this.logs.push(
      new LogEntry(
        'INFO',
        null,
        `APIs: ${sources.join(', ')}`,
      ).getLog(),
    );
    debug(`(14) TRAPI query finished.`);
    }
};
