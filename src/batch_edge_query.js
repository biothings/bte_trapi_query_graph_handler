const call_api = require('@biothings-explorer/call-apis');
const QEdge2APIEdgeHandler = require('./qedge2apiedge');
const NodesUpdateHandler = require('./update_nodes');
const debug = require('debug')('bte:biothings-explorer-trapi:batch_edge_query');
const CacheHandler = require('./cache_handler');
const { isMainThread, threadId } = require('worker_threads');

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
  async _postQueryFilter(records) {
    debug(`Filtering out "undefined" items (${records.length}) records`);
    records = records.filter((record) => record !== undefined);
    return records;
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
        if (!node.curie) {
          return;
        }
        node.curie.forEach((curie) => {
          // if the curie is already present, or an equivalent is, remove it
          if (!reducedCuries.includes(curie)) {
            const equivalentAlreadyIncluded = qEdge
              .getInputNode()
              .getEquivalentIDs()
              [curie].equivalentIDs.some((equivalentCurie) => reducedCuries.includes(equivalentCurie));
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
        qEdge.getInputNode().removeEquivalentID(curie);
      });
    });
  }

  async query(qEdges, unavailableAPIs = {}) {
    debug('Node Update Start');
    // it's now a single edge but convert to arr to simplify refactoring
    qEdges = Array.isArray(qEdges) ? qEdges : [qEdges];
    const nodeUpdate = new NodesUpdateHandler(qEdges);
    // difference is there is no previous edge info anymore
    await nodeUpdate.setEquivalentIDs(qEdges);
    await this._rmEquivalentDuplicates(qEdges);
    debug('Node Update Success');

    const cacheHandler = new CacheHandler(this.caching, this.metaKG, this.recordConfig);
    const { cachedRecords, nonCachedQEdges } = await cacheHandler.categorizeEdges(qEdges);
    this.logs = [...this.logs, ...cacheHandler.logs];
    let queryRecords;

    if (nonCachedQEdges.length === 0) {
      queryRecords = [];
      if (global.parentPort) {
        global.parentPort.postMessage({ threadId, cacheDone: true });
      }
    } else {
      debug('Start to convert qEdges into APIEdges....');
      const edgeConverter = new QEdge2APIEdgeHandler(nonCachedQEdges, this.metaKG);
      const APIEdges = await edgeConverter.convert(nonCachedQEdges);
      debug(`qEdges are successfully converted into ${APIEdges.length} APIEdges....`);
      this.logs = [...this.logs, ...edgeConverter.logs];
      if (APIEdges.length === 0 && cachedRecords.length === 0) {
        return [];
      }
      const expanded_APIEdges = this._expandAPIEdges(APIEdges);
      debug('Start to query APIEdges....');
      queryRecords = await this._queryAPIEdges(expanded_APIEdges, unavailableAPIs);
      if (queryRecords === undefined) return;
      debug('APIEdges are successfully queried....');
      queryRecords = await this._postQueryFilter(queryRecords);
      debug(`Total number of records is (${queryRecords.length})`);
      const cacheTask = cacheHandler.cacheEdges(queryRecords);
      if (!(process.env.USE_THREADING === "false")) {
        global.cachingTasks.push(cacheTask);
      } else {
        await cacheTask;
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
