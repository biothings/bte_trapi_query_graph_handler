const redisClient = require('./redis-client');
const debug = require('debug')('bte:biothings-explorer-trapi:cache_handler');
const LogEntry = require('./log_entry');
const { parentPort } = require('worker_threads');
const _ = require('lodash');
const async = require('async');
const helper = require('./helper');

module.exports = class {
  constructor(qEdges, caching, kg = undefined, logs = []) {
    this.qEdges = qEdges;
    this.kg = kg;
    this.logs = logs;
    this.cacheEnabled =
      caching === false
        ? false
        : process.env.RESULT_CACHING !== 'false'
        ? !(process.env.REDIS_HOST === undefined) && !(process.env.REDIS_PORT === undefined)
        : false;
    this.logs.push(
      new LogEntry('DEBUG', null, `REDIS cache is ${this.cacheEnabled === true ? '' : 'not'} enabled.`).getLog(),
    );
  }

  async categorizeEdges(qEdges) {
    if (this.cacheEnabled === false) {
      return {
        cachedResults: [],
        nonCachedEdges: qEdges,
      };
    }
    let nonCachedEdges = [];
    let cachedResults = [];
    for (let i = 0; i < qEdges.length; i++) {
      const hashedEdgeID = this._hashEdgeByKG(qEdges[i].getHashedEdgeRepresentation());
      let cachedResJSON;
      const unlock = await redisClient.lock('redisLock:' + id);
      try {
        const cachedRes = await redisClient.hgetallAsync(hashedEdgeID);
        cachedResJSON = cachedRes
          ? Object.entries(cachedRes)
            .sort(([key1], [key2]) => parseInt(key1) - parseInt(key2))
            .map(([key, val]) => { return JSON.parse(val); }, [])
          : null;
      } catch (error) {
        cachedResJSON = null;
        debug(`Cache lookup/retrieval failed due to ${error}. Proceeding without cache.`);
      } finally {
        unlock();
      }
      if (cachedResJSON) {
        this.logs.push(new LogEntry('DEBUG', null, `BTE find cached results for ${qEdges[i].getID()}`).getLog());
        cachedResJSON.map((rec) => {
          rec.$edge_metadata.trapi_qEdge_obj = qEdges[i];
        });
        cachedResults = [...cachedResults, ...cachedResJSON];
      } else {
        nonCachedEdges.push(qEdges[i]);
      }
    }
    return { cachedResults, nonCachedEdges };
  }

  _copyRecord(record) {
    const objs = {
      $input: record.$input.obj,
      $output: record.$output.obj,
    };

    const copyObjs = Object.fromEntries(
      Object.entries(objs).map(([which, nodes]) => {
        return [
          which,
          {
            original: record[which].original,
            obj: nodes.map((obj) => {
              const copyObj = Object.fromEntries(Object.entries(obj).filter(([key]) => !key.startsWith('__')));
              Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(obj)))
                .filter(([key, descriptor]) => typeof descriptor.get === 'function' && key !== '__proto__')
                .map(([key]) => key)
                .forEach((key) => {
                  copyObj[key] = obj[key];
                });
              return copyObj;
            }),
          },
        ];
      }),
    );

    const returnVal = { ...record };
    returnVal.$edge_metadata = { ...record.$edge_metadata };
    // replaced after taking out of cache, so save some memory
    returnVal.$edge_metadata.trapi_qEdge_obj = undefined;
    returnVal.$input = copyObjs.$input;
    returnVal.$output = copyObjs.$output;
    return returnVal;
  }

  _hashEdgeByKG(hashedEdgeID) {
    if (!this.kg) {
      return hashedEdgeID;
    }
    const len = String(this.kg.ops.length);
    const allIDs = Array.from(new Set(this.kg.ops.map((op) => op.association.smartapi.id))).join('');
    return new helper()._generateHash(hashedEdgeID + len + allIDs);
  }

  _groupQueryResultsByEdgeID(queryResult) {
    let groupedResult = {};
    queryResult.map((record) => {
      try {
        const hashedEdgeID = this._hashEdgeByKG(record.$edge_metadata.trapi_qEdge_obj.getHashedEdgeRepresentation());
        if (!(hashedEdgeID in groupedResult)) {
          groupedResult[hashedEdgeID] = [];
        }
        groupedResult[hashedEdgeID].push(this._copyRecord(record));
      } catch (e) {
        debug('skipping malformed record');
      }
    });
    return groupedResult;
  }

  async cacheEdges(queryResult) {
    if (this.cacheEnabled === false) {
      if (parentPort) {
        parentPort.postMessage({ cacheDone: true });
      }
      return;
    }
    if (parentPort) {
      parentPort.postMessage({ cacheInProgress: 1 });
    }
    debug('Start to cache query results.');
    try {
      const groupedQueryResult = this._groupQueryResultsByEdgeID(queryResult);
      const hashedEdgeIDs = Array.from(Object.keys(groupedQueryResult));
      debug(`Number of hashed edges: ${hashedEdgeIDs.length}`);
      await async.eachSeries(hashedEdgeIDs, async (id) => {
        // lock to prevent caching to/reading from actively caching edge
        const unlock = await redisClient.lock("redisLock:" + id);
        try {
          await redisClient.delAsync(id); // prevents weird overwrite edge cases
          await async.eachOfSeries(groupedQueryResult[id], async (edge, index) => {
            await redisClient.hsetAsync(id, index.toString(), JSON.stringify(edge));
          });
          await redisClient.expireAsync(id, process.env.REDIS_KEY_EXPIRE_TIME || 600);
        } finally {
          unlock(); // release lock whether cache succeeded or not
        }
      });
      debug(`Successfully cached (${queryResult.length}) query results.`);
    } catch (error) {
      debug(`Caching failed due to ${error}. This does not terminate the query.`);
    } finally {
      if (parentPort) {
        parentPort.postMessage({ cacheDone: 1 });
      }
    }
  }
};
