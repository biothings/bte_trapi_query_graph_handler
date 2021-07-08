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
// const KGFilter = require('./kg_filter');
const HopFilter = require('./hop_filter');

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

  async getResponse() {
    this.bteGraph.notify();
    // let kgf = new KGFilter(this.knowledgeGraph.kg, this.queryGraph);
    // let filtered_KG = await kgf.applyFilter();
    return {
      message: {
        query_graph: this.queryGraph,
        // knowledge_graph: filtered_KG,
        knowledge_graph: this.knowledgeGraph.kg,
        results: this.queryResults.getResults(),
      },
      // logs: [...this.logs, ...kgf.logs],
      logs: this.logs
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
      // debug(`handlers ${JSON.stringify(handlers[i].qEdges)}`);
      let res = await handlers[i].query(handlers[i].qEdges);
      //Filter each hop based on current edge
      let hopFilter = new HopFilter(res, handlers[i].qEdges);
      res = await hopFilter.applyFilter();
      //Filter end
      debug(`RES ${res}`);
      debug(`Query for depth ${i + 1} completes. ${res.length}`);
      this.logs = [...this.logs, ...handlers[i].logs, ...hopFilter.logs];
      if (res.length === 0) {
        return;
      }
      debug('Start to notify subscribers now.');
      handlers[i].notify(res);
      debug(`Updated TRAPI knowledge graph using query results for depth ${i + 1}`);

      // let res = await handlers[i].query(handlers[i].qEdges);
      // debug(`Query for depth ${i + 1} completes.`);
      // this.logs = [...this.logs, ...handlers[i].logs];
      // if (res.length === 0) {
      //   return;
      // }
      // debug('Start to notify subscribers now.');
      // handlers[i].notify(res);
      // debug(`Updated TRAPI knowledge graph using query results for depth ${i + 1}`);
    }
  }
};
