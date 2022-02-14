const redisClient = require('./redis-client');
const debug = require('debug')('bte:biothings-explorer-trapi:cache_handler');
const LogEntry = require('./log_entry');
const { parentPort } = require('worker_threads');
const _ = require('lodash');
const async = require('async');
const helper = require('./helper');
const lz4 = require('lz4');
const chunker = require('stream-chunker');
const { Readable, Transform } = require('stream');

class DelimitedChunksDecoder extends Transform {
  constructor() {
    super({
      readableObjectMode: true,
      readableHighWaterMark: 32, // limited output reduces RAM usage slightly
      writeableHighWaterMark: 100000,
    });
    this._buffer = '';
  }

  _transform(chunk, encoding, callback) {
    this._buffer += chunk;
    if (this._buffer.includes(',')) {
      const parts = this._buffer.split(',');
      this._buffer = parts.pop();
      parts.forEach((part) => {
        const parsedPart = JSON.parse(lz4.decode(Buffer.from(part, 'base64url')).toString());
        if (Array.isArray(parsedPart)) {
          parsedPart.forEach(obj => this.push(obj));
        } else { // backwards compatibility with previous implementation
          this.push(parsedPart);
        }
      });
    }
    callback(); // callback *no matter what*
  }

  _flush(callback) {
    try {
      if (this._buffer.length) {
        const final = JSON.parse(lz4.decode(Buffer.from(this._buffer, 'base64url')).toString());
        callback(null, final);
      }
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

class DelimitedChunksEncoder extends Transform {
  constructor() {
    super({
      writableObjectMode: true,
      writeableHighWaterMark: 128
    });
    this._buffer = [];
  }

  _transform(obj, encoding, callback) {
    this._buffer.push(obj); // stringify/compress 64 objects at a time limits compress calls
    if (this._buffer.length === 64) {
      const compressedPart = lz4.encode(JSON.stringify(this._buffer)).toString('base64url') + ',';
      this.push(compressedPart);
      this._buffer = [];
    }
    callback();
  }

  _flush(callback) {
    try {
      if (this._buffer.length) {
        callback(null, lz4.encode(JSON.stringify(this._buffer)).toString('base64url') + ',');
        return;
      }
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

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
    debug('Begin edge cache lookup...');
    for (let i = 0; i < qEdges.length; i++) {
      const hashedEdgeID = this._hashEdgeByKG(qEdges[i].getHashedEdgeRepresentation());
      const cachedResJSON = await new Promise(async (resolve) => {
        const redisID = 'bte:edgeCache:' + hashedEdgeID;
        const unlock = await redisClient.lock('redisLock:' + hashedEdgeID);
        try {
          const cachedRes = await redisClient.hgetallAsync(redisID);
          if (cachedRes) {
            const decodedRes = [];
            const resSorted = Object.entries(cachedRes)
              .sort(([key1], [key2]) => parseInt(key1) - parseInt(key2))
              .map(([_key, val]) => {
                return val;
              });

            const resStream = Readable.from(resSorted);
            resStream
              .pipe(this.createDecodeStream())
              .on('data', (obj) => {
                decodedRes.push(obj);
              })
              .on('end', () => {
                resolve(decodedRes)
              });
          } else {
            resolve(null);
          }
        } catch (error) {
          resolve(null);
          debug(`Cache lookup/retrieval failed due to ${error}. Proceeding without cache.`);
        } finally {
          unlock();
        }
      });

      if (cachedResJSON) {
        this.logs.push(
          new LogEntry(
            'DEBUG',
            null,
            `BTE finds cached results for ${qEdges[i].getID()}`,
            {
              type: 'cacheHit',
              edge_id: qEdges[i].getID(),
            }
          ).getLog()
        );
        cachedResJSON.map((rec) => {
          rec.$edge_metadata.trapi_qEdge_obj = qEdges[i];
        });
        cachedResults = [...cachedResults, ...cachedResJSON];
      } else {
        nonCachedEdges.push(qEdges[i]);
      }
      debug(`Found (${cachedResults.length}) cached results.`);
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

  createEncodeStream() {
    return new DelimitedChunksEncoder();
  }

  createDecodeStream() {
    return new DelimitedChunksDecoder();
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
        const unlock = await redisClient.lock('redisLock:' + id);
        try {
          const redisID = 'bte:edgeCache:' + id;
          await redisClient.delAsync(redisID); // prevents weird overwrite edge cases
          await new Promise((resolve) => {
            let i = 0;
            Readable.from(groupedQueryResult[id])
              .pipe(this.createEncodeStream())
              .pipe(chunker(100000, { flush: true }))
              .on('data', async (chunk) => {
                await redisClient.hsetAsync(redisID, String(i++), chunk);
              })
              .on('end', () => {
                resolve();
              });
          });
          await redisClient.expireAsync(redisID, process.env.REDIS_KEY_EXPIRE_TIME || 600);
        } catch (error) {
          console.log(error);
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
