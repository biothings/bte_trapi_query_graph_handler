const { Record } = require('@biothings-explorer/api-response-transform');
const path = require('path');
const fs = require('fs');
const _ = require('lodash');

const records = Record.unfreezeRecords(
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/queryRecords.json'))),
);

describe('test TRAPIQueryHandler methods', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterEach(() => {
    jest.resetAllMocks();
    process.env = OLD_ENV;
  });

  test('processQueryGraph', async () => {
    const { TRAPIQueryHandler, InvalidQueryGraphError } = require('../../src/index');
    const handler = new TRAPIQueryHandler();
    const invalidQueryGraph = {
      nodes: {},
      edges: {},
    };
    try {
      await handler._processQueryGraph(invalidQueryGraph);
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidQueryGraphError);
    }
  });

  test('dumpRecords', async () => {
    let fakeFile = '';
    jest.mock('fs', () => ({
      ...jest.requireActual('fs'),
      promises: {
        ...jest.requireActual('fs').promises,
        writeFile: jest.fn().mockImplementation((path, str) => {
          fakeFile += str;
        }),
      },
    }));
    const fs = require('fs');
    const { TRAPIQueryHandler } = require('../../src/index');
    const handler = new TRAPIQueryHandler();

    process.env.DUMP_RECORDS = 'fileLocation';

    await handler.dumpRecords(records);
    expect(fs.promises.writeFile).toHaveBeenCalled();
    expect(fakeFile.length).toBeGreaterThan(0);
    const allHashes = records.map((record) => record.recordHash);
    Record.unfreezeRecords(JSON.parse(fakeFile)).forEach((record) => {
      expect(allHashes).toContain(record.recordHash);
    });
  });

  test('queryIsOneHop', () => {
    const query = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/chemicalEntity_treats_acanthosis.json')));
    const { TRAPIQueryHandler } = require('../../src/index');
    const handler = new TRAPIQueryHandler();
    handler.setQueryGraph(query.message.query_graph);

    expect(handler._queryIsOneHop).toBeTruthy();
  });

  test('_handleInferredEdges', async () => {
    const query = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/chemicalEntity_treats_acanthosis.json')));
    const InferredQueryHandler = require('../../src/inferred_mode/inferred_mode');
    const spy = jest.spyOn(InferredQueryHandler.prototype, 'query');
    spy.mockResolvedValue('fakeResponse');
    const { TRAPIQueryHandler } = require('../../src/index');
    const handler = new TRAPIQueryHandler();
    await handler._handleInferredEdges();
    expect(handler.getResponse()).toEqual('fakeResponse');
  });

  test('query', async () => {
    const query = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../data/chemicals_targeting_IL1_Signaling_Pathway.json')),
    );
    const { TRAPIQueryHandler } = require('../../src/index');
    const handler1 = new TRAPIQueryHandler({
      smartAPIID: 'fakeID',
    });
    handler1.setQueryGraph(query.message.query_graph);
    await handler1.query();
    expect(handler1.logs.map((log) => log.level)).toContain('ERROR');
    const handler2 = new TRAPIQueryHandler({
      teamName: 'fakeID',
    });
    handler2.setQueryGraph(query.message.query_graph);
    await handler2.query();
    expect(handler2.logs.map((log) => log.level)).toContain('ERROR');
    const handler3 = new TRAPIQueryHandler({
      smartAPIID: '59dce17363dce279d389100834e43648',
    });
    handler3.setQueryGraph(query.message.query_graph);
    await handler3.query();
    expect(handler3.logs[handler3.logs.length - 1].message).toMatch(
      'smartAPI/team-specific endpoints only support single-edge queries',
    );
    const twoHopInferred = _.cloneDeep(query);
    twoHopInferred.message.query_graph.edges.e01.knowledge_type = 'inferred';
    const handler4 = new TRAPIQueryHandler();
    handler4.setQueryGraph(twoHopInferred.message.query_graph);
    await handler4.query();
    expect(handler4.logs[handler4.logs.length - 1].message).toMatch(
      'Inferred Mode edges are only supported in single-edge queries',
    );
  });

  test('findUnregisteredAPI', async() => {
    const { TRAPIQueryHandler } = require('../../src/index');
    const handler = new TRAPIQueryHandler({
      apiList: {
        include: [
          {
            id: 'fakeID',
            name: 'fake API',
          },
        ],
      },
    });
    const unregisteredAPIs = await handler.findUnregisteredAPIs();
    expect(unregisteredAPIs).toContain('fakeID');
  });
});
