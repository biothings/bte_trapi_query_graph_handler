const redisClient = require('./redis-client');
const debug = require('debug')('bte:biothings-explorer-trapi:cache_handler');
const LogEntry = require('./log_entry');
const _ = require('lodash');

module.exports = class {
  constructor(qEdges, caching, logs = []) {
    this.qEdges = qEdges;
    this.logs = logs;
    this.cacheEnabled =
      caching === 'false' ? false : !(process.env.REDIS_HOST === undefined) && !(process.env.REDIS_PORT === undefined);
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
      const hashedEdgeID = qEdges[i].getHashedEdgeRepresentation();
      const cachedRes = await redisClient.getAsync(hashedEdgeID);
      let cachedResJSON = JSON.parse(cachedRes);
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
    let new_record = {};

    const freezeClone = (obj, clone) => {
      // 'freeze' getters on this layer
      Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(obj)))
        .filter(([key, descriptor]) => typeof descriptor.get === 'function')
        .map(([key]) => key)
        .forEach((key) => {
          clone[key] =
            typeof obj[key] === 'object' ? (clone[key] = Array.isArray(obj[key]) ? [] : {}) : _.clone(obj[key]);
        });
      // look for sublayers
      Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === 'object') {
          clone[key] = Array.isArray(obj[key]) ? [] : {};
          freezeClone(obj[key], clone[key]);
        } else {
          clone[key] = obj[key];
        }
      });
      // check for sublayers of getter returns
      Object.keys(clone)
        .filter((key) => typeof Object.getOwnPropertyDescriptor(obj, key) === 'undefined')
        .forEach((key) => {
          if (typeof clone[key] === 'object') {
            freezeClone(obj[key], clone[key]);
          }
        });
    };
    freezeClone(record, new_record);
    return new_record;
  }

  _groupQueryResultsByEdgeID(queryResult) {
    let groupedResult = {};
    queryResult.map((record) => {
      const hashedEdgeID = record.$edge_metadata.trapi_qEdge_obj.getHashedEdgeRepresentation();
      if (!(hashedEdgeID in groupedResult)) {
        groupedResult[hashedEdgeID] = [];
      }
      groupedResult[hashedEdgeID].push(this._copyRecord(record));
    });
    return groupedResult;
  }

  async cacheEdges(queryResult) {
    if (this.cacheEnabled === false) {
      return;
    }
    debug('Start to cache query results.');
    const groupedQueryResult = this._groupQueryResultsByEdgeID(queryResult);
    const hashedEdgeIDs = Array.from(Object.keys(groupedQueryResult));
    debug(`Number of hashed edges: ${hashedEdgeIDs.length}`);
    for (let i = 0; i < hashedEdgeIDs.length; i++) {
      await redisClient.setAsync(
        hashedEdgeIDs[i],
        JSON.stringify(groupedQueryResult[hashedEdgeIDs[i]]),
        'EX',
        process.env.REDIS_KEY_EXPIRE_TIME || 600,
      );
    }
    debug('Successfully cached all query results.');
  }
};
