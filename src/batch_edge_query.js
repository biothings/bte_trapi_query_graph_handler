const call_api = require('@biothings-explorer/call-apis');
const QEdge2APIEdgeHandler = require('./qedge2apiedge');
const NodesUpdateHandler = require('./update_nodes');
const debug = require('debug')('bte:biothings-explorer-trapi:batch_edge_query');
const CacheHandler = require('./cache_handler');
const { parentPort, isMainThread } = require('worker_threads');

module.exports = class BatchEdgeQueryHandler {
  constructor(metaKG, resolveOutputIDs = true, options) {
    this.metaKG = metaKG;
    this.subscribers = [];
    this.logs = [];
    this.caching = options && options.caching;
    this.recordConfig = {};
    if (options && options.recordHashEdgeAttributes) {
      this.recordConfig.EDGE_ATTRIBUTES_USED_IN_RECORD_HASH = options.recordHashEdgeAttributes;
    }
    if (options && options.submitter) this.recordConfig.submitter = options.submitter;
    this.resolveOutputIDs = resolveOutputIDs;
  }

  /**
   * @param {Array} qXEdges - an array of TRAPI Query Edges;
   */
  setEdges(qXEdges) {
    this.qXEdges = qXEdges;
  }

  /**
   *
   */
  getEdges() {
    return this.qXEdges;
  }

  /**
   * @private
   */
  _expandAPIEdges(APIEdges) {
    // debug(`BTE EDGE ${JSON.stringify(this.qEdges)}`);
    return APIEdges;
  }

  /**
   * @private
   */
  async _queryAPIEdges(APIEdges, unavailableAPIs = {}) {
    let executor = new call_api(APIEdges, this.recordConfig);
    const records = await executor.query(this.resolveOutputIDs, unavailableAPIs);
    this.logs = [...this.logs, ...executor.logs];
    return records;
  }

  /**
   * @private
   */
  async _postQueryFilter(response) {
    debug(`Filtering out "undefined" items (${response.length}) records`);
    response = response.filter((res) => res !== undefined);
    return response;
  }

  /**
   * Remove curies which resolve to the same thing, keeping the first.
   * @private
   */
  async _rmEquivalentDuplicates(qXEdges) {
    Object.values(qXEdges).forEach((qXEdge) => {
      const nodes = {
        subject: qXEdge.subject,
        object: qXEdge.object,
      };
      const strippedCuries = [];
      Object.entries(nodes).forEach(([nodeType, node]) => {
        const reducedCuries = [];
        const nodeStrippedCuries = [];
        if (!node.curie) { return; }
        node.curie.forEach((curie) => {
          // if the curie is already present, or an equivalent is, remove it
          if (!reducedCuries.includes(curie)) {
            const equivalentAlreadyIncluded = qXEdge.input_equivalent_identifiers[curie][0].curies.some(
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
        delete qXEdge.input_equivalent_identifiers[curie];
      });
    });
  }

  async query(qXEdges, unavailableAPIs = {}) {
    debug('Node Update Start');
    //it's now a single edge but convert to arr to simplify refactoring
    qXEdges = Array.isArray(qXEdges) ? qXEdges : [qXEdges];
    const nodeUpdate = new NodesUpdateHandler(qXEdges);
    //difference is there is no previous edge info anymore
    await nodeUpdate.setEquivalentIDs(qXEdges);
    await this._rmEquivalentDuplicates(qXEdges);
    debug('Node Update Success');
    const cacheHandler = new CacheHandler(this.caching, this.metaKG, this.recordConfig);
    const { cachedRecords, nonCachedQXEdges } = await cacheHandler.categorizeEdges(qXEdges);
    this.logs = [...this.logs, ...cacheHandler.logs];
    let queryRecords;

    if (nonCachedQXEdges.length === 0) {
      queryRecords = [];
      if (parentPort) {
        parentPort.postMessage({ cacheDone: true });
      }
    } else {
      debug('Start to convert qXEdges into APIEdges....');
      const edgeConverter = new QEdge2APIEdgeHandler(nonCachedQXEdges, this.metaKG);
      const APIEdges = await edgeConverter.convert(nonCachedQXEdges);
      debug(`qEdges are successfully converted into ${APIEdges.length} APIEdges....`);
      this.logs = [...this.logs, ...edgeConverter.logs];
      if (APIEdges.length === 0 && cachedRecords.length === 0) {
        return [];
      }
      const expanded_APIEdges = this._expandAPIEdges(APIEdges);
      debug('Start to query APIEdges....');
      queryRecords = await this._queryAPIEdges(expanded_APIEdges, unavailableAPIs);
      debug('APIEdges are successfully queried....');
      debug(`Filtering out any "undefined" items in (${queryRecords.length}) records`);
      queryRecords = queryRecords.filter((record) => record !== undefined);
      debug(`Total number of records is (${queryRecords.length})`);
      if (!isMainThread) {
        cacheHandler.cacheEdges(queryRecords);
      } else { // await caching if async so end of job doesn't cut it off
        await cacheHandler.cacheEdges(queryRecords);
      }
    }
    queryRecords = [...queryRecords, ...cachedRecords];
    debug('Start to update nodes...');
    nodeUpdate.update(queryRecords);
    debug('Update nodes completed!');
    return queryRecords;
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
