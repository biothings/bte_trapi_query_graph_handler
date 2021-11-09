const call_api = require('@biothings-explorer/call-apis');
const QEdge2BTEEdgeHandler = require('./qedge2bteedge');
const NodesUpdateHandler = require('./update_nodes');
const debug = require('debug')('bte:biothings-explorer-trapi:batch_edge_query');
const CacheHandler = require('./cache_handler');
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
    response = response.filter((res) => res !== undefined);
    return response;
  }

  /**
   * Remove curies which resolve to the same thing, keeping the first.
   * @private
   */
  async _rmEquivalentDuplicates(qEdges) {
    Object.values(qEdges).forEach((qEdge) => {
      const nodes = {
        subject: qEdge.subject,
        object: qEdge.object,
      };
      const strippedCuries = [];
      Object.entries(nodes).forEach(([nodeType, node]) => {
        const reducedCuries = [];
        const nodeStrippedCuries = [];
        if (!node.curie) { return; }
        node.curie.forEach((curie) => {
          // if the curie is already present, or an equivalent is, remove it
          if (!reducedCuries.includes(curie)) {
            const equivalentAlreadyIncluded = qEdge.input_equivalent_identifiers[curie][0].curies.some(
              (equivalentCurie) => reducedCuries.includes(equivalentCurie),
            );
            if (!equivalentAlreadyIncluded) {
              reducedCuries.push(curie);
            } else {
              nodeStrippedCuries.push(curie);
            }
          }
        });
        node.curie = reducedCuries;
        strippedCuries.push(...nodeStrippedCuries);
        if (nodeStrippedCuries.length > 0) {
          debug(
            `stripped (${nodeStrippedCuries.length}) duplicate equivalent curies from ${
              node.id
            }: ${nodeStrippedCuries.join(',')}`,
          );
        }
      });
      strippedCuries.forEach((curie) => {
        delete qEdge.input_equivalent_identifiers[curie];
      });
    });
  }

  async query(qEdges) {
    debug('Node Update Start');
    //it's now a single edge but convert to arr to simplify refactoring
    qEdges = Array.isArray(qEdges) ? qEdges : [qEdges];
    const nodeUpdate = new NodesUpdateHandler(qEdges);
    //difference is there is no previous edge info anymore
    await nodeUpdate.setEquivalentIDs(qEdges);
    await this._rmEquivalentDuplicates(qEdges);
    debug('Node Update Success');
    const cacheHandler = new CacheHandler(qEdges, this.caching);
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
      debug(`Filtering out any "undefined" items in (${query_res.length}) results`);
      query_res = query_res.filter((res) => res !== undefined);
      debug(`Total number of results is (${query_res.length})`);
      cacheHandler.cacheEdges(query_res);
    }
    query_res = [...query_res, ...cachedResults];
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
