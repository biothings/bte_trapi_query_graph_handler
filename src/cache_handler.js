const { redisClient } = require('./redis-client');
const debug = require('debug')('bte:biothings-explorer-trapi:cache_handler');
const LogEntry = require('./log_entry');
const _ = require('lodash');
const async = require('async');
const helper = require('./helper');
const lz4 = require('lz4');
const chunker = require('stream-chunker');
const { Readable, Transform } = require('stream');
const { Record } = require('@biothings-explorer/api-response-transform');
const { threadId } = require('worker_threads');

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
  constructor(caching, metaKG = undefined, recordConfig = {}, logs = []) {
    this.metaKG = metaKG;
    this.logs = logs;
    this.cacheEnabled =
      caching === false
        ? false
        : process.env.RESULT_CACHING !== 'false'
        ? !(process.env.REDIS_HOST === undefined) && !(process.env.REDIS_PORT === undefined)
        : false;
    this.recordConfig = recordConfig;
    this.logs.push(
      new LogEntry('DEBUG', null, `REDIS cache is ${this.cacheEnabled === true ? '' : 'not'} enabled.`).getLog(),
    );
  }

  async categorizeEdges(qEdges) {
    if (this.cacheEnabled === false || process.env.INTERNAL_DISABLE_REDIS) {
      return {
        cachedRecords: [],
        nonCachedQEdges: qEdges,
      };
    }
    let nonCachedQEdges = [];
    let cachedRecords = [];
    debug('Begin edge cache lookup...');
    await async.eachSeries(qEdges, async (qEdge) => {
      const qEdgeMetaKGHash = this._hashEdgeByMetaKG(qEdge.getHashedEdgeRepresentation());
      const unpackedRecords = await new Promise(async (resolve) => {
        const redisID = 'bte:edgeCache:' + qEdgeMetaKGHash;
        await redisClient.client.usingLock([`redisLock:${redisID}`], 600000, async (signal) => {
          try {
            const compressedRecordPack = await redisClient.client.hgetallTimeout(redisID);

            if (compressedRecordPack && Object.keys(compressedRecordPack).length) {
              const recordPack = [];

              const sortedPackParts = Object.entries(compressedRecordPack)
                .sort(([key1], [key2]) => parseInt(key1) - parseInt(key2))
                .map(([_key, val]) => {
                  return val;
                });

              const recordStream = Readable.from(sortedPackParts);
              recordStream
                .pipe(this.createDecodeStream())
                .on('data', (obj) => recordPack.push(obj))
                .on('end', () => resolve(Record.unpackRecords(recordPack, qEdge, this.recordConfig)));
            } else {
              resolve(null);
            }
          } catch (error) {
            resolve(null);
            debug(`Cache lookup/retrieval failed due to ${error}. Proceeding without cache.`);
          }
        });
      });

      if (unpackedRecords) {
        this.logs.push(
          new LogEntry(
            'DEBUG',
            null,
            `BTE finds cached records for ${qEdge.getID()}`,
            {
              type: 'cacheHit',
              qEdgeID: qEdge.getID(),
            }
          ).getLog()
        );
        cachedRecords = [...cachedRecords, ...unpackedRecords];
      } else {
        nonCachedQEdges.push(qEdge);
      }
      debug(`Found (${cachedRecords.length}) cached records.`);
    });

    return { cachedRecords, nonCachedQEdges };
  }

  _hashEdgeByMetaKG(qEdgeHash) {
    if (!this.metaKG) {
      return qEdgeHash;
    }
    const len = String(this.metaKG.ops.length);
    const allIDs = Array.from(new Set(this.metaKG.ops.map((op) => op.association.smartapi.id))).join('');
    return helper._generateHash(qEdgeHash + len + allIDs);
  }

  _groupQueryRecordsByQEdgeHash(queryRecords) {
    let groupedRecords = {};
    queryRecords.map((record) => {
      try {
        const qEdgeMetaKGHash = this._hashEdgeByMetaKG(record.qEdge.getHashedEdgeRepresentation());
        if (!(qEdgeMetaKGHash in groupedRecords)) {
          groupedRecords[qEdgeMetaKGHash] = [];
        }
        groupedRecords[qEdgeMetaKGHash].push(record);
      } catch (e) {
        debug('skipping malformed record');
      }
    });
    Object.entries(groupedRecords).forEach(([qEdgeMetaKGHash, records]) => {
      groupedRecords[qEdgeMetaKGHash] = Record.packRecords(records);
    });
    return groupedRecords;
  }

  createEncodeStream() {
    return new DelimitedChunksEncoder();
  }

  createDecodeStream() {
    return new DelimitedChunksDecoder();
  }

  async cacheEdges(queryRecords) {
    if (this.cacheEnabled === false || process.env.INTERNAL_DISABLE_REDIS) {
      if (global.parentPort) {
        global.parentPort.postMessage({ threadId, cacheDone: true });
      }
      return;
    }
    if (global.parentPort) {
      global.parentPort.postMessage({ threadId, cacheInProgress: 1 });
    }
    debug('Start to cache query records.');
    try {
      const groupedRecords = this._groupQueryRecordsByQEdgeHash(queryRecords);
      const qEdgeHashes = Array.from(Object.keys(groupedRecords));
      debug(`Number of hashed edges: ${qEdgeHashes.length}`);
      const failedHashes = [];
      await async.eachSeries(qEdgeHashes, async (hash) => {
        // lock to prevent caching to/reading from actively caching edge
        const redisID = 'bte:edgeCache:' + hash;
        if (global.parentPort) {
          global.parentPort.postMessage({ threadId, addCacheKey: redisID });
        }
        await redisClient.client.usingLock([`redisLock:${redisID}`], 600000, async (signal) => {
          try {
            await redisClient.client.delTimeout(redisID); // prevents weird overwrite edge cases
            await new Promise((resolve, reject) => {
              let i = 0;
              Readable.from(groupedRecords[hash])
                .pipe(this.createEncodeStream())
                .pipe(chunker(100000, { flush: true }))
                .on('data', async (chunk) => {
                  try {
                    await redisClient.client.hsetTimeout(redisID, String(i++), chunk);
                  } catch (error) {
                    reject(error);
                    try {
                      await redisClient.client.delTimeout(redisID);
                    } catch (e) {
                      debug(`Unable to remove partial cache ${redisID} from redis during cache failure due to error ${error}. This may result in failed or improper cache retrieval of this qEdge.`)
                    }
                  }
                })
                .on('end', () => {
                  resolve();
                });
            });
            await redisClient.client.expireTimeout(redisID, process.env.REDIS_KEY_EXPIRE_TIME || 1800);
          } catch (error) {
            failedHashes.push(hash);
            debug(`Failed to cache qEdge ${hash} records due to error ${error}. This does not stop other edges from caching nor terminate the query.`)
          } finally {
            if (global.parentPort) {
              global.parentPort.postMessage({ threadId, completeCacheKey: redisID });
            }
          }
        });
      });
      const successCount = Object.entries(groupedRecords).reduce((acc, [hash, records]) => {
        return failedHashes.includes(hash) ? acc : acc + records.length;
      }, 0);
      if (successCount) {
        debug(`Successfully cached (${successCount}) query records.`);
      } else {
        debug(`qEdge caching failed.`);
      }
    } catch (error) {
      debug(`Caching failed due to ${error}. This does not terminate the query.`);
    } finally {
      if (global.parentPort) {
        global.parentPort.postMessage({ threadId, cacheDone: 1 });
      }
    }
  }
};
