const { TRAPIQueryHandler } = require('../../src/index');
const path = require('path');
const fs = require('fs');
const smartAPIPAth = path.resolve(__dirname, '../../../bte-trapi/data/smartapi_specs.json');
const predicatesPath = path.resolve(__dirname, '../../../bte-trapi/data/predicates.json');
const _ = require('lodash');

const queryGraph1 = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/chemicalEntity_treats_acanthosis.json')),
).message.query_graph;

describe('Test InferredQueryHandler', () => {
  test('queryIsValid', () => {
    const InferredQueryHandler = require('../../src/inferred_mode/inferred_mode');
    const noCategories = _.cloneDeep(queryGraph1);
    Object.values(noCategories.nodes).forEach((node) => {
      node.categories = null;
    });

    let handler = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      noCategories,
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );

    expect(handler.queryIsValid).toBeFalsy();

    const missingID = _.cloneDeep(queryGraph1);
    Object.values(missingID.nodes).forEach((node) => {
      node.ids = null;
    });

    handler = new InferredQueryHandler({}, TRAPIQueryHandler, missingID, [], {}, smartAPIPAth, predicatesPath, true);

    expect(handler.queryIsValid).toBeFalsy();

    const missingPredicate = _.cloneDeep(queryGraph1);
    Object.values(missingPredicate.edges).forEach((edge) => {
      edge.predicates = null;
    });

    handler = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      missingPredicate,
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );

    expect(handler.queryIsValid).toBeFalsy();

    const tooManyIDs = _.cloneDeep(queryGraph1);
    Object.values(tooManyIDs.nodes).forEach((node) => {
      node.ids = ['id0', 'id1'];
    });

    handler = new InferredQueryHandler({}, TRAPIQueryHandler, tooManyIDs, [], {}, smartAPIPAth, predicatesPath, true);

    expect(handler.queryIsValid).toBeFalsy();

    const multiplePredicates = _.cloneDeep(queryGraph1);
    Object.values(multiplePredicates.edges).forEach((edge) => {
      edge.predicates = ['pred0', 'pred1'];
    });

    handler = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      multiplePredicates,
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );

    expect(handler.queryIsValid).toBeFalsy();

    handler = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      queryGraph1,
      [],
      { smartAPIID: 'test', teamName: 'test' },
      smartAPIPAth,
      predicatesPath,
      true,
    );

    expect(handler.queryIsValid).toBeFalsy();

    handler = new InferredQueryHandler({}, TRAPIQueryHandler, queryGraph1, [], {}, smartAPIPAth, predicatesPath, true);

    expect(handler.queryIsValid).toBeTruthy();
  });

  test('getQueryParts', () => {
    const InferredQueryHandler = require('../../src/inferred_mode/inferred_mode');
    const handler = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      queryGraph1,
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );

    const { qEdgeID, qEdge, qSubject, qObject } = handler.getQueryParts();
    expect(qEdgeID).toEqual('e01');
    expect(qEdge).toStrictEqual(queryGraph1.edges.e01);
    expect(qSubject).toStrictEqual(queryGraph1.nodes.n01);
    expect(qObject).toStrictEqual(queryGraph1.nodes.n02);
  });

  describe('findTemplates', () => {
    test('find templates', async () => {
      // may need updates if biolink changes significantly
      const InferredQueryHandler = require('../../src/inferred_mode/inferred_mode');
      const handler = new InferredQueryHandler(
        {},
        TRAPIQueryHandler,
        queryGraph1,
        [],
        {},
        smartAPIPAth,
        predicatesPath,
        true,
      );
      const { qEdgeID, qEdge, qSubject, qObject } = handler.getQueryParts();

      const templates = await handler.findTemplates(qEdge, qSubject, qObject);
      expect(templates.length).toBeGreaterThan(1);
      expect(
        templates.every((template) => {
          return 'creativeQuerySubject' in template.nodes && 'creativeQueryObject' in template.nodes;
        }),
      ).toBeTruthy();
    });

    test("don't find templates", async () => {
      const InferredQueryHandler = require('../../src/inferred_mode/inferred_mode');
      // may need updates if biolink changes significantly
      const badQuery = _.cloneDeep(queryGraph1);
      badQuery.nodes.n01.categories = ['biolink:disease'];
      const logs = [];

      const handler = new InferredQueryHandler(
        {},
        TRAPIQueryHandler,
        badQuery,
        logs,
        {},
        smartAPIPAth,
        predicatesPath,
        true,
      );
      const { qEdgeID, qEdge, qSubject, qObject } = handler.getQueryParts();

      const templates = await handler.findTemplates(qEdge, qSubject, qObject);
      expect(templates).toHaveLength(0);
      expect(logs[logs.length - 1].message).toMatch('Your query terminates');
    });
  });

  test('createQueries', async () => {
    const InferredQueryHandler = require('../../src/inferred_mode/inferred_mode');
    const handler = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      queryGraph1,
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );
    const { qEdgeID, qEdge, qSubject, qObject } = handler.getQueryParts();

    const subQueries = await handler.createQueries(qEdge, qSubject, qObject);

    subQueries.forEach((queryGraph) => {
      expect(queryGraph.nodes.creativeQuerySubject.categories).toContain('biolink:ChemicalEntity');
      expect(queryGraph.nodes.creativeQueryObject.categories).toContain('biolink:Disease');
      expect(queryGraph.nodes.creativeQueryObject.ids).toContain('MONDO:0007035');
      expect(queryGraph.nodes.creativeQuerySubject.ids).toBeUndefined();
    });
  });

  test('combineResponse', () => {
    const InferredQueryHandler = require('../../src/inferred_mode/inferred_mode');
    const inferredQueryHandler = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      queryGraph1,
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );
    inferredQueryHandler.CREATIVE_LIMIT = 3;
    const trapiQueryHandler0 = new TRAPIQueryHandler();
    trapiQueryHandler0.logs.push({
      message: 'new fake log',
    });
    trapiQueryHandler0.getResponse = () => ({
      workflow: [{ id: 'lookup' }],
      message: {
        query_graph: {
          nodes: {
            creativeQuerySubject: {
              categories: ['biolink:SmallMolecule'],
            },
            creativeQueryObject: {
              categories: ['biolink:Disease'],
              ids: ['fakeDiseaseID'],
            },
          },
          edges: {
            e0: {
              subject: 'creativeQuerySubject',
              object: 'creativeQueryObject',
              predicate: 'biolink:treats',
            },
          },
        },
        knowledge_graph: {
          nodes: {
            fakeCompound1: {
              categories: ['biolink:SmallMolecule'],
              name: 'fakeCompound1',
            },
            fakeCompound2: {
              categories: ['biolink:SmallMolecule'],
              name: 'fakeCompound2',
            },
            fakeCompound3: {
              categories: ['biolink:SmallMolecule'],
              name: 'fakeCompound3',
            },
            fakeDisease1: {
              categories: ['biolink:Disease'],
              name: 'fakeDisease1',
            },
          },
          edges: {
            edgeHash1: {
              predicate: 'biolink:treats',
              subject: 'fakeCompound2',
              object: 'fakeDisease1',
            },
            edgeHash2: {
              predicate: 'biolink:treats',
              subject: 'fakeCompound1',
              object: 'fakeDisease1',
            },
            edgeHash3: {
              predicate: 'biolink:treats',
              subject: 'fakeCompound3',
              object: 'fakeDisease1',
            },
          },
        },
        results: [
          {
            node_bindings: {
              creativeQuerySubject: [
                {
                  id: 'fakeCompound2',
                },
              ],
              creativeQueryObject: [
                {
                  id: 'fakeDisease1',
                },
              ],
            },
            edge_bindings: {
              e0: [
                {
                  id: 'edgeHash1',
                },
              ],
            },
            score: 0.5,
          },
          {
            node_bindings: {
              creativeQuerySubject: [
                {
                  id: 'fakeCompound1',
                },
              ],
              creativeQueryObject: [
                {
                  id: 'fakeDisease1',
                },
              ],
            },
            edge_bindings: {
              e0: [
                {
                  id: 'edgeHash2',
                },
              ],
            },
            score: 0.25,
          },
          {
            node_bindings: {
              creativeQuerySubject: [
                {
                  id: 'fakeCompound3',
                },
              ],
              creativeQueryObject: [
                {
                  id: 'fakeDisease1',
                },
              ],
            },
            edge_bindings: {
              e0: [
                {
                  id: 'edgeHash3',
                },
              ],
            },
            score: 0.2,
          },
        ],
      },
      logs: [
        {
          message: 'new fake log',
        },
      ],
    });
    const trapiQueryHandler1 = new TRAPIQueryHandler();
    trapiQueryHandler1.getResponse = () => ({
      workflow: [{ id: 'lookup' }],
      message: {
        query_graph: {
          nodes: {
            creativeQuerySubject: {
              categories: ['biolink:SmallMolecule'],
            },
            creativeQueryObject: {
              categories: ['biolink:Disease'],
              ids: ['fakeDiseaseID'],
            },
            n01: {
              categories: ['biolink:Gene'],
              ids: ['aGeneThatCausesFakeDisease1'],
            },
          },
          edges: {
            e0: {
              subject: 'creativeQuerySubject',
              object: 'creativeQueryObject',
              predicate: 'biolink:treats',
            },
            e01: {
              subject: 'creativeQuerySubject',
              object: 'someIntermediateNode',
              predicate: 'biolink:negatively_regulates',
            },
          },
        },
        knowledge_graph: {
          nodes: {
            fakeGene1: {
              categories: ['biolink:Gene'],
              name: 'fakeGene1',
            },
            fakeCompound4: {
              categories: ['biolink:SmallMolecule'],
              name: 'fakeCompound4',
            },
            fakeDisease1: {
              categories: ['biolink:Disease'],
              name: 'fakeDisease1',
            },
          },
          edges: {
            edgeHash1: {
              predicate: 'biolink:negatively_regulates',
              subject: 'fakeCompound4',
              object: 'fakeGene1',
            },
            edgeHash2: {
              predicate: 'biolink:causes',
              subject: 'fakeGene1',
              object: 'fakeDisease1',
            },
          },
        },
        results: [
          {
            node_bindings: {
              creativeQuerySubject: [
                {
                  id: 'fakeCompound4',
                },
              ],
              creativeQueryObject: [
                {
                  id: 'fakeDisease1',
                },
              ],
              n01: [
                {
                  id: 'fakeGene1',
                },
              ],
            },
            edge_bindings: {
              e0: [
                {
                  id: 'edgeHash1',
                },
              ],
              e01: [
                {
                  id: 'edgeHash2',
                },
              ],
            },
            score: 0.99,
          },
        ],
      },
      logs: [
        {
          message: 'new fake log',
        },
      ],
    });

    const combinedResponse = {
      workflow: [{ id: 'lookup' }],
      message: {
        query_graph: queryGraph1,
        knowledge_graph: {
          nodes: {
            fakeCompound1: {
              categories: ['biolink:SmallMolecule'],
              name: 'fakeCompound1',
            },
            fakeCompound3: {
              categories: ['biolink:SmallMolecule'],
              name: 'fakeCompound3',
            },
            fakeDisease1: {
              categories: ['biolink:Disease'],
              name: 'fakeDisease1',
            },
          },
          edges: {
            edgeHash1: {
              predicate: 'biolink:treats',
              subject: 'fakeCompound1',
              object: 'fakeDisease1',
            },
            edgeHash2: {
              predicate: 'biolink:treats',
              subject: 'fakeCompound3',
              object: 'fakeDisease1',
            },
          },
        },
        results: {
          'fakeCompound1-fakeDisease1': {
            node_bindings: {
              n01: [
                {
                  id: 'fakeCompound1',
                },
              ],
              n02: [
                {
                  id: 'fakeDisease1',
                },
              ],
            },
            edge_bindings: {
              e01: [
                {
                  id: 'edgeHash1',
                },
              ],
            },
            score: 0.75,
          },
          'fakeCompound3-fakeDisease1': {
            node_bindings: {
              n01: [
                {
                  id: 'fakeCompound3',
                },
              ],
              n02: [
                {
                  id: 'fakeDisease1',
                },
              ],
            },
            edge_bindings: {
              e01: [
                {
                  id: 'edgeHash2',
                },
              ],
            },
            score: undefined,
          },
        },
      },
      logs: [
        {
          message: 'fake initial log',
        },
      ],
    };

    const { qEdgeID, qEdge, qSubject, qObject } = inferredQueryHandler.getQueryParts();

    const reservedIDs = { nodes: ['n01', 'n02'], edges: ['e01'] };

    const { querySuccess, queryHadResults, mergedResults, creativeLimitHit } = inferredQueryHandler.combineResponse(
      1,
      trapiQueryHandler0,
      qEdge,
      combinedResponse,
      reservedIDs,
    );
    expect(querySuccess).toBeTruthy();
    expect(queryHadResults).toBeTruthy();
    expect(Object.keys(mergedResults)).toHaveLength(2);
    expect(Object.values(mergedResults)[0]).toEqual(2);
    expect(creativeLimitHit).toBeTruthy();
    expect(Object.keys(combinedResponse.message.results)).toHaveLength(3);
    expect(combinedResponse.message.results['fakeCompound1-fakeDisease1'].score).toEqual(1);
    expect(combinedResponse.message.results['fakeCompound3-fakeDisease1'].score).toEqual(0.2);
    expect(combinedResponse.logs).toHaveLength(2);
    expect(combinedResponse.logs[1].message).toMatch('Template-1');

    const {
      querySuccess: querySuccess1,
      queryHadResults: queryHadResults1,
      mergedResults: mergedResults1,
      creativeLimitHit: creativeLimitHit1,
    } = inferredQueryHandler.combineResponse(2, trapiQueryHandler1, qEdge, combinedResponse, reservedIDs);

    expect(querySuccess1).toBeTruthy();
    expect(queryHadResults1).toBeTruthy();
    expect(Object.keys(mergedResults1)).toHaveLength(0);
    expect(creativeLimitHit1).toBeTruthy();
    // expect()
    expect(reservedIDs.nodes).toContain('n02');
    expect(reservedIDs.nodes).toContain('n03');
  });

  test('pruneKnowledgeGraph', () => {
    const InferredQueryHandler = require('../../src/inferred_mode/inferred_mode');
    const handler = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      queryGraph1,
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );
    const combinedResponse = {
      workflow: [{ id: 'lookup' }],
      message: {
        query_graph: queryGraph1,
        knowledge_graph: {
          nodes: {
            fakeCompound1: {
              categories: ['biolink:SmallMolecule'],
              name: 'fakeCompound1',
            },
            fakeCompound3: {
              categories: ['biolink:SmallMolecule'],
              name: 'fakeCompound3',
            },
            fakeDisease1: {
              categories: ['biolink:Disease'],
              name: 'fakeDisease1',
            },
          },
          edges: {
            edgeHash1: {
              predicate: 'biolink:treats',
              subject: 'fakeCompound1',
              object: 'fakeDisease1',
            },
            edgeHash2: {
              predicate: 'biolink:treats',
              subject: 'fakeCompound3',
              object: 'fakeDisease1',
            },
          },
        },
        results: [
          {
            node_bindings: {
              n01: [
                {
                  id: 'fakeCompound1',
                },
              ],
              n02: [
                {
                  id: 'fakeDisease1',
                },
              ],
            },
            edge_bindings: {
              e01: [
                {
                  id: 'edgeHash1',
                },
              ],
            },
            score: 0.75,
          },
        ],
      },
      logs: [
        {
          message: 'fake initial log',
        },
      ],
    };

    handler.pruneKnowledgeGraph(combinedResponse);
    expect(combinedResponse.message.knowledge_graph.nodes).not.toHaveProperty('fakeCompounds3');
    expect(combinedResponse.message.knowledge_graph.edges).not.toHaveProperty('edgeHash2');
  });

  test('query', async () => {
    const querySpy = jest.spyOn(TRAPIQueryHandler.prototype, 'query');
    querySpy.mockImplementation(async () => {});
    const responseSpy = jest.spyOn(TRAPIQueryHandler.prototype, 'getResponse');
    responseSpy.mockImplementation(() => {
      return {
        workflow: [{ id: 'lookup' }],
        message: {
          query_graph: {
            nodes: {
              creativeQuerySubject: {
                categories: ['biolink:SmallMolecule'],
              },
              creativeQueryObject: {
                categories: ['biolink:Disease'],
                ids: ['fakeDiseaseID'],
              },
            },
            edges: {
              e0: {
                subject: 'creativeQuerySubject',
                object: 'creativeQueryObject',
                predicate: 'biolink:treats',
              },
            },
          },
          knowledge_graph: {
            nodes: {
              creativeQuerySubject: {
                categories: ['biolink:SmallMolecule'],
                name: 'fakeCompound1',
              },
              creativeQueryObject: {
                categories: ['biolink:Disease'],
                name: 'fakeDisease1',
              },
            },
            edges: {
              edgeHash1: {
                predicate: 'biolink:treats',
                subject: 'creativeQuerySubject',
                object: 'creativeQueryObject',
              },
            },
          },
          results: [
            {
              node_bindings: {
                creativeQuerySubject: [
                  {
                    id: 'creativeQuerySubject',
                  },
                ],
                creativeQueryObject: [
                  {
                    id: 'creativeQueryObject',
                  },
                ],
              },
              edge_bindings: {
                e01: [
                  {
                    id: 'edgeHash1',
                  },
                ],
              },
              score: 0.75,
            },
          ],
        },
        logs: [
          {
            message: 'fake initial log',
          },
        ],
      };
    });
    const InferredQueryHandler = require('../../src/inferred_mode/inferred_mode');

    const parentHandler = new TRAPIQueryHandler()

    const handler = new InferredQueryHandler(
      parentHandler,
      TRAPIQueryHandler,
      queryGraph1,
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );

    const response = await handler.query();
    expect(response).toBeTruthy();
    expect(Object.keys(response.logs).length).toBeGreaterThan(0);
    expect(response.message.results).toHaveLength(1);
  });
});
