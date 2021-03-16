const redisClient = require("../../src/redis-client");

describe("Test redis client", () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
        jest.resetModules() // Most important - it clears the cache
        process.env = { ...OLD_ENV }; // Make a copy
    });

    afterAll(() => {
        process.env = OLD_ENV; // Restore old environment
    });
    test("return empty object when REDIS_HOST is not set", () => {
        const client = require("../../src/redis-client");
        expect(client).toEqual({});
    })

    test('will receive process.env variables', () => {
        // Set the variables
        process.env.REDIS_HOST = 'localhost';
        process.env.REDIS_PORT = 3367;
        const client = require("../../src/redis-client");
        expect(client).not.toEqual({});
    });

    test("Test if record is correctly stored", async () => {
        process.env.REDIS_HOST = 'localhost';
        process.env.REDIS_PORT = 3367;
        const client = require("../../src/redis-client");
        await client.setAsync(
            'record1',
            'hello',
        );
        const res = await client.getAsync('record1');
        expect(res).toEqual("hello");
    })

    test("Test if record is correctly stored", async () => {
        process.env.REDIS_HOST = 'localhost';
        process.env.REDIS_PORT = 3367;
        const client = require("../../src/redis-client");
        await client.setAsync(
            'record1',
            'hello',
        );
        const res = await client.getAsync('record1');
        expect(res).toEqual("hello");
    })

    test("Test key should be removed after ttl", async () => {
        process.env.REDIS_HOST = 'localhost';
        process.env.REDIS_PORT = 3367;
        const client = require("../../src/redis-client");
        await client.setAsync(
            'record1',
            'hello',
            'EX',
            2
        );
        await new Promise(r => setTimeout(r, 3000));
        const res = await client.getAsync('record1');
        expect(res).not.toBeNull;
    })

})