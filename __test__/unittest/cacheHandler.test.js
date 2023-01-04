const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { Record } = require('@biothings-explorer/api-response-transform');
const Redis = require('ioredis-mock');

const qEdges = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/qEdges.json')), { encoding: 'utf8' });

const records = Record.unfreezeRecords(
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/queryRecords.json')), { encoding: 'utf8' }),
);

describe('test cache handler', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    jest.resetModules(); // Most important - it clears the cache
    jest.clearAllMocks();
    process.env = { ...OLD_ENV }; // Make a copy
    new Redis().flushall();
  });

  afterAll(() => {
    process.env = OLD_ENV; // Restore old environment
  });

  describe("ensure caching isn't used when it shouldn't be", () => {
    test("don't use cache when explicitely disabled", async () => {
      process.env.REDIS_HOST = 'mocked';
      process.env.REDIS_PORT = 'mocked';
      const CacheHandler = require('../../src/cache_handler');
      const cacheHandler = new CacheHandler(false);
      const categorizeEdges = jest.spyOn(CacheHandler.prototype, 'categorizeEdges');
      const _hashEdgeByMetaKG = jest.spyOn(CacheHandler.prototype, '_hashEdgeByMetaKG');
      const _groupQueryRecordsByQEdgeHash = jest.spyOn(CacheHandler.prototype, '_groupQueryRecordsByQEdgeHash');

      expect(cacheHandler.cacheEnabled).toBeFalsy();

      const { cachedRecords, nonCachedQEdges } = await cacheHandler.categorizeEdges(qEdges);
      expect(categorizeEdges).toHaveBeenCalledTimes(1);
      expect(_hashEdgeByMetaKG).toHaveBeenCalledTimes(0);
      expect(cachedRecords).toHaveLength(0);
      expect(nonCachedQEdges).toHaveLength(1);
      expect(nonCachedQEdges).toEqual(qEdges);

      await cacheHandler.cacheEdges(records);
      expect(_groupQueryRecordsByQEdgeHash).toHaveBeenCalledTimes(0);
    });

    test("don't use cache when explicitely disabled by ENV", async () => {
      process.env.REDIS_HOST = 'mocked';
      process.env.REDIS_PORT = 'mocked';
      process.env.RESULT_CACHING = 'false';
      const CacheHandler = require('../../src/cache_handler');
      const cacheHandler = new CacheHandler(true);
      const categorizeEdges = jest.spyOn(CacheHandler.prototype, 'categorizeEdges');
      const _hashEdgeByMetaKG = jest.spyOn(CacheHandler.prototype, '_hashEdgeByMetaKG');
      const _groupQueryRecordsByQEdgeHash = jest.spyOn(CacheHandler.prototype, '_groupQueryRecordsByQEdgeHash');

      expect(cacheHandler.cacheEnabled).toBeFalsy();

      const { cachedRecords, nonCachedQEdges } = await cacheHandler.categorizeEdges(qEdges);
      expect(categorizeEdges).toHaveBeenCalledTimes(1);
      expect(_hashEdgeByMetaKG).toHaveBeenCalledTimes(0);
      expect(cachedRecords).toHaveLength(0);
      expect(nonCachedQEdges).toHaveLength(1);
      expect(nonCachedQEdges).toEqual(qEdges);

      await cacheHandler.cacheEdges(records);
      expect(_groupQueryRecordsByQEdgeHash).toHaveBeenCalledTimes(0);
    });

    test("don't use cache when redis disabled", async () => {
      const CacheHandler = require('../../src/cache_handler');
      const cacheHandler = new CacheHandler(true);
      const categorizeEdges = jest.spyOn(CacheHandler.prototype, 'categorizeEdges');
      const _hashEdgeByMetaKG = jest.spyOn(CacheHandler.prototype, '_hashEdgeByMetaKG');
      const _groupQueryRecordsByQEdgeHash = jest.spyOn(CacheHandler.prototype, '_groupQueryRecordsByQEdgeHash');

      expect(cacheHandler.cacheEnabled).toBeFalsy();

      const { cachedRecords, nonCachedQEdges } = await cacheHandler.categorizeEdges(qEdges);
      expect(categorizeEdges).toHaveBeenCalledTimes(1);
      expect(_hashEdgeByMetaKG).toHaveBeenCalledTimes(0);
      expect(cachedRecords).toHaveLength(0);
      expect(nonCachedQEdges).toHaveLength(1);
      expect(nonCachedQEdges).toEqual(qEdges);

      await cacheHandler.cacheEdges(records);
      expect(_groupQueryRecordsByQEdgeHash).toHaveBeenCalledTimes(0);
    });

    test("don't use cache when redis specially disabled", async () => {
      process.env.REDIS_HOST = 'mocked';
      process.env.REDIS_PORT = 'mocked';
      process.env.INTERNAL_DISABLE_REDIS = true;
      const CacheHandler = require('../../src/cache_handler');
      const cacheHandler = new CacheHandler(true);
      const categorizeEdges = jest.spyOn(CacheHandler.prototype, 'categorizeEdges');
      const _hashEdgeByMetaKG = jest.spyOn(CacheHandler.prototype, '_hashEdgeByMetaKG');
      const _groupQueryRecordsByQEdgeHash = jest.spyOn(CacheHandler.prototype, '_groupQueryRecordsByQEdgeHash');

      const { cachedRecords, nonCachedQEdges } = await cacheHandler.categorizeEdges(qEdges);
      expect(categorizeEdges).toHaveBeenCalledTimes(1);
      expect(_hashEdgeByMetaKG).toHaveBeenCalledTimes(0);
      expect(cachedRecords).toHaveLength(0);
      expect(nonCachedQEdges).toHaveLength(1);
      expect(nonCachedQEdges).toEqual(qEdges);

      await cacheHandler.cacheEdges(records);
      expect(_groupQueryRecordsByQEdgeHash).toHaveBeenCalledTimes(0);
    });
  });

  describe('test encoding/decoding', () => {
    test('test encoder', async () => {
      const CacheHandler = require('../../src/cache_handler');
      const cacheHandler = new CacheHandler(true);
      const encoder = cacheHandler.createEncodeStream();

      let encodedString = '';

      await new Promise((resolve) => {
        Readable.from(Record.freezeRecords(records))
          .pipe(encoder)
          .on('data', async (chunk) => {
            encodedString += chunk;
          })
          .on('end', () => resolve());
      });

      expect(encodedString).toBeTruthy();
      expect(encodedString.includes(',')).toBeTruthy();
      expect(encodedString.length).toBeLessThan(JSON.stringify(records).length);
    });

    test('test decoder', async () => {
      const CacheHandler = require('../../src/cache_handler');
      const cacheHandler = new CacheHandler(true);
      const encoder = cacheHandler.createEncodeStream();
      const decoder = cacheHandler.createDecodeStream();

      let encodedString = '';

      await new Promise((resolve) => {
        Readable.from(Record.freezeRecords(records))
          .pipe(encoder)
          .on('data', async (chunk) => {
            encodedString += chunk;
          })
          .on('end', () => resolve());
      });

      const decodedObjs = [];

      await new Promise((resolve) => {
        Readable.from(encodedString)
          .pipe(decoder)
          .on('data', async (obj) => {
            decodedObjs.push(obj);
          })
          .on('end', () => resolve());
      });

      expect(decodedObjs).toStrictEqual(JSON.parse(JSON.stringify(Record.freezeRecords(records))));
    });
  });

  describe('Test _hashEdgeByMetaKG', () => {
    test('without metaKG', () => {
      const CacheHandler = require('../../src/cache_handler');
      const cacheHandler = new CacheHandler(true);
      const hash = cacheHandler._hashEdgeByMetaKG('test');

      expect(hash).toEqual('test');
    });

    test('with metaKG', () => {
      const CacheHandler = require('../../src/cache_handler');

      const fakeMetaKG1 = {
        ops: [
          {
            association: {
              smartapi: {
                id: 'someFakeID1',
              },
            },
          },
          {
            association: {
              smartapi: {
                id: 'someFakeID2',
              },
            },
          },
        ],
      };
      const fakeMetaKG2 = {
        ops: [
          {
            association: {
              smartapi: {
                id: 'someFakeID1',
              },
            },
          },
          {
            association: {
              smartapi: {
                id: 'someFakeID3',
              },
            },
          },
        ],
      };
      const fakeMetaKG3 = {
        ops: [
          {
            association: {
              smartapi: {
                id: 'someFakeID1',
              },
            },
          },
        ],
      };
      const cacheHandler1 = new CacheHandler(true, fakeMetaKG1);
      const hash1 = cacheHandler1._hashEdgeByMetaKG('test');

      const cacheHandler2 = new CacheHandler(true, fakeMetaKG2);
      const hash2 = cacheHandler2._hashEdgeByMetaKG('test');

      const cacheHandler3 = new CacheHandler(true, fakeMetaKG3);
      const hash3 = cacheHandler3._hashEdgeByMetaKG('test');

      expect(hash1 === 'test').toBeFalsy();
      expect(hash1 === hash2).toBeFalsy();
      expect(hash1 === hash3).toBeFalsy();
      expect(hash2 === hash3).toBeFalsy();
    });
  });

  test('_groupQueryRecordsByQEdgeHash', () => {
    process.env.REDIS_HOST = 'mocked';
    process.env.REDIS_PORT = 'mocked';
    const CacheHandler = require('../../src/cache_handler');
    const cacheHandler = new CacheHandler(true);
    const groups = cacheHandler._groupQueryRecordsByQEdgeHash(records);

    const numHashes = records.reduce((set, record) => {
      set.add(record.qEdge.getHashedEdgeRepresentation());
      return set;
    }, new Set()).size;

    expect(Object.keys(groups)).toHaveLength(numHashes);
    expect(
      Object.values(groups).reduce((arr, group) => {
        arr = [...arr, ...group];
        return arr;
      }, []),
    ).toHaveLength(records.length + numHashes);
  });

  test('caching and cache lookup', async () => {
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = 1234;
    const CacheHandler = require('../../src/cache_handler');
    const cacheHandler = new CacheHandler(true);
    const redisClient = new Redis();

    await cacheHandler.cacheEdges(records);
    const qEdges = Object.values(
      records.reduce((obj, record) => {
        if (!(record.qEdge.getHashedEdgeRepresentation() in obj)) {
          obj[record.qEdge.getHashedEdgeRepresentation()] = record.qEdge;
        }
        return obj;
      }, {}),
    );
    const { cachedRecords, nonCachedQEdges } = await cacheHandler.categorizeEdges(qEdges);
    expect(nonCachedQEdges).toHaveLength(0);
    expect(cachedRecords).toHaveLength(records.length);
    // TODO get each record sorted by hash to compare individually
    const originalRecordHashes = records.reduce((set, record) => {
      set.add(record.recordHash);
      return set;
    }, new Set());
    const cachedRecordHashes = cachedRecords.reduce((set, record) => {
      set.add(record.recordHash);
      return set;
    }, new Set());
    const setsMatch = [...originalRecordHashes].every((hash) => cachedRecordHashes.has(hash));
    expect(originalRecordHashes.size).toEqual(cachedRecordHashes.size);
    expect(setsMatch).toBeTruthy();
  });
});
