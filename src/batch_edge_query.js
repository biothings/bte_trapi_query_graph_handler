const call_api = require('@biothings-explorer/call-apis');
const QEdge2BTEEdgeHandler = require('./qedge2bteedge');
const NodesUpdateHandler = require('./update_nodes');
const debug = require('debug')('bte:biothings-explorer-trapi:batch_edge_query');
const CacheHandler = require('./cache_handler');
const utils = require('./utils');
const LogEntry = require('./log_entry');
const { parentPort } = require('worker_threads');

module.exports = class BatchEdgeQueryHandler {
  constructor(kg, resolveOutputIDs = true, options) {
    this.kg = kg;
    this.subscribers = [];
    this.logs = [];
    this.caching = options && options.caching;
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
    // debug(`BTE EDGE ${JSON.stringify(this.qEdges)}`);
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
    debug(`Filtering out "undefined" items (${response.length}) results`);
    response = response.filter(res => res !== undefined );
    return response;
  }

  async query(qEdges) {
    debug('Node Update Start');
    const nodeUpdate = new NodesUpdateHandler(qEdges);
    await nodeUpdate.setEquivalentIDs(qEdges);
    debug('Node Update Success');
    const cacheHandler = new CacheHandler(qEdges, this.caching);
    const { cachedResults, nonCachedEdges } = await cacheHandler.categorizeEdges(qEdges);
    this.logs = [...this.logs, ...cacheHandler.logs];
    let query_res;

    if (nonCachedEdges.length === 0) {
      query_res = [];
    } else {
      debug('Start to convert qEdges into BTEEdges....');
      const edgeConverter = new QEdge2BTEEdgeHandler(nonCachedEdges, this.kg);
      const bteEdges = await edgeConverter.convert(nonCachedEdges);
      debug(`qEdges are successfully converted into ${bteEdges.length} BTEEdges....`);
      this.logs = [...this.logs, ...edgeConverter.logs];
      if (bteEdges.length === 0 && cachedResults.length === 0) {
        return [];
      }
      const expanded_bteEdges = this._expandBTEEdges(bteEdges);
      debug('Start to query BTEEdges....');
      query_res = await this._queryBTEEdges(expanded_bteEdges);
      debug('BTEEdges are successfully queried....');
      cacheHandler.cacheEdges(query_res);
    }
    query_res = [...query_res, ...cachedResults];
    debug(`Filtering out any "undefined" items in (${query_res.length}) results`);
    query_res = query_res.filter(res => res !== undefined );
    debug(`Total number of results is (${query_res.length})`);
    debug('Start to update nodes...');
    nodeUpdate.update(query_res);
    debug('Update nodes completed!');
    return query_res;
  }

  async query_2(qEdges) {
    debug('Node Update Start');
    //it's now a single edge but convert to arr to simplify refactoring
    qEdges = Array.isArray(qEdges) ? qEdges : [qEdges];
    const nodeUpdate = new NodesUpdateHandler(qEdges);
    //difference is there is no previous edge info anymore
    await nodeUpdate.setEquivalentIDs_2(qEdges);
    debug('Node Update Success');
    const cacheHandler = new CacheHandler(qEdges);
    const { cachedResults, nonCachedEdges } = await cacheHandler.categorizeEdges(qEdges);
    this.logs = [...this.logs, ...cacheHandler.logs];
    let query_res;

    if (nonCachedEdges.length === 0) {
      query_res = [];
      if (parentPort) {
        parentPort.postMessage({ cacheDone: true });
      }
    } else {
      debug('Start to convert qEdges into BTEEdges....');
      const edgeConverter = new QEdge2BTEEdgeHandler(nonCachedEdges, this.kg);
      const bteEdges = await edgeConverter.convert(nonCachedEdges);
      debug(`qEdges are successfully converted into ${bteEdges.length} BTEEdges....`);
      this.logs = [...this.logs, ...edgeConverter.logs];
      if (bteEdges.length === 0 && cachedResults.length === 0) {
        return [];
      }
      const expanded_bteEdges = this._expandBTEEdges(bteEdges);
      debug('Start to query BTEEdges....');
      query_res = await this._queryBTEEdges(expanded_bteEdges);
      debug('BTEEdges are successfully queried....');
      cacheHandler.cacheEdges(query_res);
    }
    query_res = [...query_res, ...cachedResults];
    debug(`Filtering out any "undefined" items in (${query_res.length}) results`);
    query_res = query_res.filter(res => res !== undefined );
    debug(`Total number of results is (${query_res.length})`);
    debug('Start to update nodes...');
    nodeUpdate.update(query_res);
    debug('Update nodes completed!');
    return query_res;
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
