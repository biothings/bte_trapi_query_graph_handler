const meta_kg = require('@biothings-explorer/smartapi-kg');
const fs = require('fs');
var path = require('path');
const util = require('util');
const readFile = util.promisify(fs.readFile);
const BatchEdgeQueryHandler = require('./batch_edge_query');
const QueryGraph = require('./query_graph');
const KnowledgeGraph = require('./graph/knowledge_graph');
const QueryResults = require('./query_results');
const InvalidQueryGraphError = require('./exceptions/invalid_query_graph_error');
const debug = require('debug')('bte:biothings-explorer-trapi:main');
const Graph = require('./graph/graph');
const EdgeManager = require('./edge_manager');
const LogEntry = require('./log_entry');

exports.InvalidQueryGraphError = InvalidQueryGraphError;

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
      message: {
        query_graph: this.queryGraph,
        knowledge_graph: this.knowledgeGraph.kg,
        results: this.queryResults.getResults(),
      },
      logs: this.logs,
    };
  }

  /**
   * Set TRAPI Query Graph
   * @param {object} queryGraph - TRAPI Query Graph Object
   */
  setQueryGraph(queryGraph) {
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
  _processQueryGraph(queryGraph) {
    try {
      let queryGraphHandler = new QueryGraph(queryGraph);
      let res = queryGraphHandler.createQueryPaths();
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

  /**
   * @private
   * @param {object} queryGraph - TRAPI Query Graph Object
   */
   _processQueryGraph_2(queryGraph) {
    try {
      let queryGraphHandler = new QueryGraph(queryGraph);
      let res = queryGraphHandler.calculateEdges();
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
      handlers[index] = new BatchEdgeQueryHandler(kg, this.resolveOutputIDs);
      handlers[index].setEdges(queryPaths[index]);
      handlers[index].subscribe(this.queryResults);
      handlers[index].subscribe(this.bteGraph);
    }
    return handlers;
  }

  async query() {
    this._initializeResponse();
    debug('start to load metakg.');
    const kg = this._loadMetaKG(this.smartapiID, this.team);
    debug('metakg successfully loaded');
    let queryPaths = this._processQueryGraph(this.queryGraph);
    debug(`query paths constructed: ${JSON.stringify(queryPaths)}`);
    const handlers = this._createBatchEdgeQueryHandlers(queryPaths, kg);
    debug(`Query depth is ${Object.keys(handlers).length}`);
    for (let i = 0; i < Object.keys(handlers).length; i++) {
      debug(`Start to query depth ${i + 1}`);
      let res = await handlers[i].query(handlers[i].qEdges);
      debug(`Query for depth ${i + 1} completes.`);
      this.logs = [...this.logs, ...handlers[i].logs];
      if (res.length === 0) {
        return;
      }
      debug('Start to notify subscribers now.');
      handlers[i].notify(res);
      debug(`Updated TRAPI knowledge graph using query results for depth ${i + 1}`);
    }
  }

  _createBatchEdgeQueryHandlersForCurrent(currentEdge, kg) {
    let handler = new BatchEdgeQueryHandler(kg, this.resolveOutputIDs);
    handler.setEdges(currentEdge);
    handler.subscribe(this.queryResults);
    handler.subscribe(this.bteGraph);
    return handler;
  }

  async query_2() {
    this._initializeResponse();
    debug('start to load metakg.');
    const kg = this._loadMetaKG(this.smartapiID, this.team);
    debug('metakg successfully loaded');
    let queryEdges = this._processQueryGraph_2(this.queryGraph);
    debug(`(3) All edges created ${JSON.stringify(queryEdges)}`);
    const manager = new EdgeManager(queryEdges);
    while (manager.getEdgesNotExecuted()) {
      let current_edge = manager.getNext();
      let handler = this._createBatchEdgeQueryHandlersForCurrent(current_edge, kg);
      debug(`(5) Executing current edge >> "${current_edge.getID()}"`);
      //execute current edge query
      let res = await handler.query_2(handler.qEdges);
      this.logs = [...this.logs, ...handler.logs];
      if (res.length === 0) {
        return;
      }
      //storing results will trigger
      //a node entity count update
      current_edge.storeResults(res, current_edge.reverse);
      debug(`(10) Edge successfully queried.`);
      current_edge.executed = true;
    };
    //after all edges have been executed collect all results
    manager.gatherResults();
    this.logs = [...this.logs, ...manager.logs];
    //mock handler created only to update query graph and results
    //TODO find a way to just update these with no mock handler
    let mockHandler = this._createBatchEdgeQueryHandlersForCurrent([], kg);
    mockHandler.notify(manager.results);
    debug(`(13) FINISHED`);
    }
};
