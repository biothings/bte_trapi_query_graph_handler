const redis = require('redis');
// const { checkServerIdentity } = require("tls");
const redisLock = require('redis-lock');
const { promisify } = require('util');


let client;


const enableRedis = !(process.env.REDIS_HOST === undefined) && !(process.env.REDIS_PORT === undefined);
const prefix = `{BTEHashSlotPrefix}`

if (enableRedis === true) {
  const details = {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
  };
  if (process.env.REDIS_PASSWORD) { details.auth_pass = process.env.REDIS_PASSWORD }
  if (process.env.REDIS_TLS_ENABLED) { details.tls = { checkServerIdentity: () => undefined } }
  client = redis.createClient(details);
}

const timeoutFunc = (func, timeoutms=0) => {
  return (...args) => {
    return new Promise(async (resolve, reject) => {
      const timeout = timeoutms
        ? timeoutms
        : parseInt(process.env.REDIS_TIMEOUT || 60000);
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
      args[0] = `${prefix}:${args[0]}`
    }
    return func(...args);
  }
}

const addPrefixToAll = (func) => {
  return (...args) => {
    return func(...args.map((arg) => `${prefix}:${arg}`));
  }
}


const redisClient =
  enableRedis === true
    ? {
        ...client,
        getAsync: addPrefix(timeoutFunc(promisify(client.get).bind(client))),
        setAsync: addPrefix(timeoutFunc(promisify(client.set).bind(client))),
        hsetAsync: addPrefix(timeoutFunc(promisify(client.hset).bind(client))),
        hgetallAsync: addPrefix(timeoutFunc(promisify(client.hgetall).bind(client))),
        expireAsync: addPrefix(timeoutFunc(promisify(client.expire).bind(client))),
        delAsync: addPrefixToAll(timeoutFunc(promisify(client.del).bind(client))),
        lock: addPrefix(timeoutFunc(promisify(redisLock(client)), 5 * 60000)),
        // hmsetAsync: timeoutFunc(promisify(client.hmset).bind(client)),
        // keysAsync: timeoutFunc(promisify(client.keys).bind(client)),
        existsAsync: addPrefixToAll(timeoutFunc(promisify(client.exists).bind(client))),
        pingAsync: timeoutFunc(promisify(client.ping).bind(client), 10000) // for testing
      }
    : {};
module.exports = redisClient;
