const Redis = require('ioredis');
const debug = require('debug')('bte:biothings-explorer-trapi:redis-client');
const Redlock = require('redlock').default;

const prefix = `{BTEHashSlotPrefix}`;

const timeoutFunc = (func, timeoutms = 0) => {
  return (...args) => {
    return new Promise(async (resolve, reject) => {
      const timeout = timeoutms ? timeoutms : parseInt(process.env.REDIS_TIMEOUT || 60000);
      let done = false;
      setTimeout(() => {
        if (!done) {
          reject(new Error(`redis call timed out, args: ${JSON.stringify(...args)}`));
        }
      }, timeout);
      const returnValue = await func(...args);
      done = true;
      resolve(returnValue);
    });
  };
};

const addPrefix = (func) => {
  return (...args) => {
    if (args.length > 0) {
      args[0] = `${prefix}:${args[0]}`;
    }
    return func(...args);
  };
};

const addPrefixToAll = (func) => {
  return (...args) => {
    return func(...args.map((arg) => `${prefix}:${arg}`));
  };
};

const lockPrefix = (func) => {
  return async (...args) => {
    return await func(
      args[0].map((lockName) => `${prefix}:${lockName}`),
      ...args.slice(1),
    );
  };
};

class RedisClient {
  constructor() {
    this.client;
    this.enableRedis = !(process.env.REDIS_HOST === undefined) && !(process.env.REDIS_PORT === undefined);

    if (!this.enableRedis) {
      this.client = {};
      this.clientEnabled = false;
      return;
    }

    if (process.env.REDIS_CLUSTER === 'true') {
      let cluster;

      const details = {
        redisOptions: {
          connectTimeout: 20000,
        },
        clusterRetryStrategy(times) {
          return Math.min(times * 100, 5000);
        },
      };

      if (process.env.REDIS_PASSWORD) {
        details.redisOptions.password = process.env.REDIS_PASSWORD;
      }
      if (process.env.REDIS_TLS_ENABLED) {
        details.redisOptions.tls = { checkServerIdentity: () => undefined };
      }

      cluster = new Redis.Cluster(
        [
          {
            host: process.env.REDIS_HOST,
            port: process.env.REDIS_PORT,
          },
        ],
        details,
      );

      // allow up to 10 minutes to acquire lock (in case of large items being saved/retrieved)
      const redlock = new Redlock([cluster], { retryDelay: 500, retryCount: 1200 });

      this.internalClient = cluster;

      this.client = {
        ...cluster,
        getTimeout: addPrefix(timeoutFunc((...args) => cluster.get(...args))),
        setTimeout: addPrefix(timeoutFunc((...args) => cluster.set(...args))),
        hsetTimeout: addPrefix(timeoutFunc((...args) => cluster.hset(...args))),
        hgetallTimeout: addPrefix(timeoutFunc((...args) => cluster.hgetall(...args))),
        expireTimeout: addPrefix(timeoutFunc((...args) => cluster.expire(...args))),
        delTimeout: addPrefixToAll(timeoutFunc((...args) => cluster.del(...args))),
        usingLock: lockPrefix((...args) => redlock.using(...args)),
        // hmsetTimeout: timeoutFunc((...args) => cluster.hmset(...args)),
        // keysTimeout: timeoutFunc((...args) => cluster.keys(...args)),
        existsTimeout: addPrefix(timeoutFunc((...args) => cluster.exists(...args))),
        pingTimeout: timeoutFunc((...args) => cluster.ping(...args), 10000), // for testing
      };
      debug('Initialized redis client (cluster-mode)');
    } else {
      let client;

      const details = {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        connectTimeout: 20000,
        retryStrategy(times) {
          return Math.min(times * 100, 5000);
        },
      };
      if (process.env.REDIS_PASSWORD) {
        details.password = process.env.REDIS_PASSWORD;
      }
      if (process.env.REDIS_TLS_ENABLED) {
        details.tls = { checkServerIdentity: () => undefined };
      }
      client = new Redis(details);

      // allow up to 10 minutes to acquire lock (in case of large items being saved/retrieved)
      const redlock = new Redlock([client], { retryDelay: 500, retryCount: 1200 });

      this.internalClient = client;

      this.client = {
        ...client,
        getTimeout: timeoutFunc((...args) => client.get(...args)),
        setTimeout: timeoutFunc((...args) => client.set(...args)),
        hsetTimeout: timeoutFunc((...args) => client.hset(...args)),
        hgetallTimeout: timeoutFunc((...args) => client.hgetall(...args)),
        expireTimeout: timeoutFunc((...args) => client.expire(...args)),
        delTimeout: timeoutFunc((...args) => client.del(...args)),
        usingLock: lockPrefix((...args) => redlock.using(...args)),
        incrTimeout: timeoutFunc((...args) => client.incr(...args)),
        decrTimeout: timeoutFunc((...args) => client.decr(...args)),
        // hmsetTimeout: timeoutFunc((...args) => client.hmset(...args)),
        // keysTimeout: timeoutFunc((...args) => client.keys(...args)),
        existsTimeout: timeoutFunc((...args) => client.exists(...args)),
        pingTimeout: timeoutFunc((...args) => client.ping(...args), 10000), // for testing
      };
      debug('Initialized redis client (non-cluster-mode)');
    }
    this.clientEnabled = true;
  }
}

const primaryClient = new RedisClient();

const classClientFactory = {
  redisClient: primaryClient,
  getNewRedisClient() {
    return new RedisClient();
  }
}

module.exports = classClientFactory
