const call_api = require('@biothings-explorer/call-apis');
const QEdge2BTEEdgeHandler = require('./qedge2bteedge');
const NodesUpdateHandler = require('./update_nodes');
const debug = require('debug')('biothings-explorer-trapi:batch_edge_query');
const CacheHandler = require('./cache_handler');
const utils = require('./utils');
const LogEntry = require('./log_entry');

module.exports = class BatchEdgeQueryHandler {
  constructor(kg, resolveOutputIDs = true) {
    this.kg = kg;
    this.subscribers = [];
    this.logs = [];
    this.resolveOutputIDs = resolveOutputIDs;
  }

  /**
   * @param {Array} qEdges - an array of TRAPI Query Edges;
   */
  setEdges(qEdges) {
    this.qEdges = qEdges;
  }

  /**
   *
   */
  getEdges() {
    return this.qEdges;
  }

  /**
   * @private
   */
  _expandBTEEdges(bteEdges) {
    debug(`BTE EDGE ${JSON.stringify(this.qEdges)}`);
    return bteEdges;
  }

  /**
   * @private
   */
  async _queryBTEEdges(bteEdges) {
    let executor = new call_api(bteEdges);
    const res = await executor.query(this.resolveOutputIDs);
    this.logs = [...this.logs, ...executor.logs];
    return res;
  }

  /**
   * @private
   */
  async _postQueryFilter(response) {
    try {
      const filtered = response.filter(item => {
        debug(`ITEM ${JSON.stringify(item)}`);
        if (
          'predicate' in item['$edge_metadata']['trapi_qEdge_obj']['qEdge']&&
          'expanded_predicates' in item['$edge_metadata']['trapi_qEdge_obj']['qEdge']
        ) {
          let edge_predicate = item['$edge_metadata']['predicate'];
          let predicate_filters = [];
          predicate_filters = item['$edge_metadata']['trapi_qEdge_obj']['qEdge']['expanded_predicates'];
          if (predicate_filters) {
            //add query predicate to the expanded list
            predicate_filters.concat(edge_predicate);
            //remove prefix from filter list to match predicate name format
            predicate_filters = predicate_filters.map((item) => utils.removeBioLinkPrefix(item));
            //compare edge predicate to filter list
            this.logs.push(
              new LogEntry('DEBUG', null, `query_graph_handler: Current edge post-query predicate restriction includes: ${JSON.stringify(predicate_filters)}`).getLog()
            );
            if (predicate_filters.includes(edge_predicate)) {
              return item;
            }
          }else{
            // No predicate restriction on this edge, just add to results
            return item
          }
        }else{
          // No predicate restriction on this edge, just add to results
          return item;
        }
      });
      // filter result
      debug(`Filtered results from ${response.length} down to ${filtered.length} results`);
      this.logs.push(
        new LogEntry('DEBUG', null, `query_graph_handler: Total number of results returned for this query is ${response.length}.`).getLog()
      );
      this.logs.push(
        new LogEntry('DEBUG', null, `query_graph_handler: Successfully applied post-query predicate restriction with ${filtered.length} results.`).getLog()
      );
      return filtered
    } catch (error) {
      // in case of rare failure return all
      debug(`Failed to filter ${response.length} results due to ${error}`);
      return response;
    }
  }

  async query(qEdges) {
    const nodeUpdate = new NodesUpdateHandler(qEdges);
    await nodeUpdate.setEquivalentIDs(qEdges);
    const cacheHandler = new CacheHandler(qEdges);
    const { cachedResults, nonCachedEdges } = await cacheHandler.categorizeEdges(qEdges);
    this.logs = [...this.logs, ...cacheHandler.logs];
    let query_res;

    if (nonCachedEdges.length === 0) {
      query_res = [];
    } else {
      debug('Start to convert qEdges into BTEEdges....');
      const edgeConverter = new QEdge2BTEEdgeHandler(nonCachedEdges, this.kg);
      const bteEdges = edgeConverter.convert(nonCachedEdges);
      debug(`qEdges are successfully converted into ${bteEdges.length} BTEEdges....`);
      this.logs = [...this.logs, ...edgeConverter.logs];
      if (bteEdges.length === 0 && cachedResults.length === 0) {
        return [];
      }
      const expanded_bteEdges = this._expandBTEEdges(bteEdges);
      debug('Start to query BTEEdges....');
      query_res = await this._queryBTEEdges(expanded_bteEdges);
      debug('BTEEdges are successfully queried....');
      await cacheHandler.cacheEdges(query_res);
    }
    query_res = [...query_res, ...cachedResults];
    const processed_query_res = await this._postQueryFilter(query_res);
    debug(`Total number of response is ${processed_query_res.length}`);
    debug('Start to update nodes,hi.');
    nodeUpdate.update(processed_query_res);
    debug('update nodes completed');
    return processed_query_res;
  }

  /**
   * Register subscribers
   * @param {object} subscriber
   */
  subscribe(subscriber) {
    this.subscribers.push(subscriber);
  }

  /**
   * Unsubscribe a listener
   * @param {object} subscriber
   */
  unsubscribe(subscriber) {
    this.subscribers = this.subscribers.filter((fn) => {
      if (fn != subscriber) return fn;
    });
  }

  /**
   * Nofity all listeners
   */
  notify(res) {
    this.subscribers.map((subscriber) => {
      subscriber.update(res);
    });
  }
};
