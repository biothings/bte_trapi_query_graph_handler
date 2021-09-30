const redisClient = require('./redis-client');
const debug = require('debug')('bte:biothings-explorer-trapi:cache_handler');
const LogEntry = require('./log_entry');
const _ = require('lodash');

module.exports = class {
  constructor(qEdges, caching, logs = []) {
    this.qEdges = qEdges;
    this.logs = logs;
    this.cacheEnabled =
      caching === 'false'
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
      const hashedEdgeID = qEdges[i].getHashedEdgeRepresentation();
      const cachedRes = await redisClient.hgetallAsync(hashedEdgeID);
      // let cachedResJSON = JSON.parse(cachedRes);
      let cachedResJSON = cachedRes
        ? Object.entries(cachedRes)
          .sort(([key1], [key2]) => parseInt(key1) - parseInt(key2))
          .map(([key, val]) => { return JSON.parse(val); }, [])
         : null;
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

    // const copyObjs = Object.fromEntries(Object.entries(objs).map(([which, obj]) => {
    //   const copyObj = Object.fromEntries(Object.entries(obj).filter(([key]) => !key.startsWith('__')));
    //   Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(obj)))
    //     .filter(([key, descriptor]) => typeof descriptor.get === 'function' && key !== '__proto__')
    //     .map(([key]) => key)
    //     .forEach((key) => {
    //       copyObj[key] = obj[key];
    //     });

    //   return [which, copyObj];
    // }));

    // const copyObjs = {};

    // Object.entries(objs).forEach(([which, obj]) => {
    //   copyObjs[which] = Object.fromEntries(
    //     Object.entries(obj)
    //       .filter(([key, val]) => !key.startsWith('_'))
    //   );

    //   Object.entries(Object.getOwnPropertyDescriptors(Object.getPrototypeOf(obj)))
    //     .filter(([key, descriptor]) => typeof descriptor.get === 'function' && key !== '__proto__')
    //     .map(([key]) => key)
    //     .forEach((key) => {
    //       copyObjs[which][key] = obj[key];
    //     });
    // });
    const returnVal = { ...record };
    returnVal.$edge_metadata = { ...record.$edge_metadata };
    // // replaced after taking out of cahce, so save some memory
    returnVal.$edge_metadata.trapi_qEdge_obj = undefined;
    returnVal.$input = copyObjs.$input;
    returnVal.$output = copyObjs.$output;
    return returnVal;
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
    // try {
    await Promise.all(
      hashedEdgeIDs.map(async (id) => {
        // const chunksize = 100;
        // for (let i = 0; i < groupedQueryResult[id].length; i += chunksize) {
        //   await redisClient.hsetAsync(id, i.toString(), JSON.stringify(groupedQueryResult[id].slice(i, i + chunksize)));
        // }
        // await redisClient.expire(id, process.env.REDIS_KEY_EXPIRE_TIME || 600);
        await Promise.all(groupedQueryResult[id].map(async (edge, index) => {
          await redisClient.hsetAsync(
            id,
            index.toString(),
            JSON.stringify(edge),
          );
        }));
        await redisClient.expire(id, process.env.REDIS_KEY_EXPIRE_TIME || 600);
      }),
    );
    // for (let i = 0; i < hashedEdgeIDs.length; i++) {
    //   await redisClient.setAsync(
    //     hashedEdgeIDs[i],
    //     JSON.stringify(groupedQueryResult[hashedEdgeIDs[i]]),
    //     'EX',
    //     process.env.REDIS_KEY_EXPIRE_TIME || 600,
    //   );
    // }
    debug('Successfully cached all query results.');
    // } catch (error) {
    //   debug(`Caching failed due to ${error}. This does not terminate the query.`);
    // }
  }
};
