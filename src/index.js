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
    this.isExplain = false;
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
    // let kg = {}
    // if (this.isExplain) {
    //   let hopFilter = new HopFilter(this.knowledgeGraph.kg, handlers[i].qEdges);
    //   kg = await hopFilter.applyFilter();
    // }else{
    //   kg = this.knowledgeGraph.kg;
    // }
    return {
      message: {
        query_graph: this.queryGraph,
        knowledge_graph: this.knowledgeGraph.kg,
        results: this.queryResults.getResults(),
      },
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

  _isBasicExplainQuery() {
    debug(`QG ${JSON.stringify(this.queryGraph)}`);
    let nodes = this.queryGraph.nodes;
    const max_explain_nodes = 3;
    let isExplainQuery = false;
    let nodeTotal = Object.keys(nodes).length;
    debug(`NODE TOTAL ${nodeTotal}`);
    if (nodeTotal > 1 && nodeTotal <= max_explain_nodes) {
      //check first and last nodes provides curies
      let first_node_has_ids = Object.hasOwnProperty
      .call(nodes[Object.keys(nodes)[0]], 'ids');
      let last_node_has_ids = Object.hasOwnProperty
      .call(nodes[Object.keys(nodes)[nodeTotal - 1]], 'ids');
      if (first_node_has_ids && last_node_has_ids) {
        debug(`FIRST ${first_node_has_ids}, LAST ${last_node_has_ids}`);
        //if nodes have ids but node count exceeds max
        if (nodeTotal > max_explain_nodes) {
          throw new InvalidQueryGraphError(
            `Explain query max node count (${max_explain_nodes}) exceeded.`,
          );
        }
        isExplainQuery = true;
      }
    }
    return isExplainQuery;
  }

  async query() {
    this._initializeResponse();
    this.isExplain = this._isBasicExplainQuery();
    debug(`Is this an explain query? ${this.isExplain ? 'YES' : 'NO'}`);
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
};
