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

    const missingPredicateType2 = _.cloneDeep(queryGraph1);
    Object.values(missingPredicateType2.edges).forEach((edge) => {
      edge.predicates = [];
    });

    handler = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      missingPredicateType2,
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

    const queryParts = handler.getQueryParts();
    expect(queryParts).toHaveProperty('qEdgeID');
    expect(queryParts).toHaveProperty('qEdge');
    expect(queryParts).toHaveProperty('qSubject');
    expect(queryParts).toHaveProperty('qObject');
    const { qEdgeID, qEdge, qSubject, qObject } = queryParts;
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
    const spy = jest.spyOn(InferredQueryHandler.prototype, 'findTemplates');

    const templates = [
      {
        nodes: {
          creativeQuerySubject: {
            categories: [],
          },
          nA: {
            categories: [],
          },
          creativeQueryObject: {
            categories: [],
          },
        },
        edges: {
          eA: {
            subject: 'creativeQuerySubject',
            object: 'nA',
            predicates: [],
          },
          eB: {
            subject: 'nA',
            object: 'creativeQueryObject',
            predicates: [],
          },
        },
      },
    ];

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
    expect(spy).toHaveBeenCalled();

    subQueries.forEach((queryGraph) => {
      expect(queryGraph.nodes.creativeQuerySubject.categories).toContain('biolink:ChemicalEntity');
      expect(queryGraph.nodes.creativeQueryObject.categories).toContain('biolink:Disease');
      expect(queryGraph.nodes.creativeQueryObject.ids).toContain('MONDO:0007035');
      expect(queryGraph.nodes.creativeQuerySubject.ids).toBeUndefined();
    });

    // check that undefined deletion works
    const handler2 = new InferredQueryHandler(
      {},
      TRAPIQueryHandler,
      {
        nodes: {
          n02: {
            categories: [],
            ids: [],
          },
          n01: {
            categories: [],
          },
        },
        edges: {
          e01: {
            subject: 'n01',
            object: 'n02',
            predicates: [],
            knowledge_type: 'inferred',
          },
        },
      },
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );
    const { qEdgeID: qEdgeID1, qEdge: qEdge1, qSubject: qSubject1, qObject: qObject1 } = handler2.getQueryParts();
    spy.mockResolvedValueOnce(templates);
    const subQueries1 = await handler2.createQueries(qEdge1, qSubject1, qObject1);
    expect(spy).toHaveBeenCalled();
    expect(subQueries1[0].nodes.creativeQuerySubject.categories).toBeUndefined();
    expect(subQueries1[0].nodes.creativeQueryObject.categories).toBeUndefined();
    expect(subQueries1[0].nodes.creativeQuerySubject.ids).toBeUndefined();
    expect(subQueries1[0].nodes.creativeQueryObject.ids).toBeUndefined();
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
            e01: {
              subject: 'creativeQuerySubject',
              object: 'creativeQueryObject',
              predicates: ['biolink:treats'],
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

    let reservedIDs = { nodes: ['n01', 'n02'], edges: ['e01'] };

    const report = inferredQueryHandler.combineResponse(1, trapiQueryHandler0, qEdge, combinedResponse, reservedIDs);

    expect(report).toHaveProperty('querySuccess');
    expect(report).toHaveProperty('queryHadResults');
    expect(report).toHaveProperty('mergedResults');
    expect(report).toHaveProperty('creativeLimitHit');

    expect(reservedIDs.edges).toContain('e02');

    const { querySuccess, queryHadResults, mergedResults, creativeLimitHit } = report;
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
              predicate: ['biolink:treats'],
            },
            e01: {
              subject: 'creativeQuerySubject',
              object: 'someIntermediateNode',
              predicate: ['biolink:negatively_regulates'],
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
            fakeCompound1: {
              categories: ['biolink:SmallMolecule'],
              name: 'fakeCompound1',
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
            edgeHash3: {
              predicate: 'biolink:treats',
              subject: 'fakeCompound1',
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
                  id: 'edgeHash3',
                },
              ],
            },
            score: undefined,
          },
        ],
      },
      logs: [
        {
          message: 'new fake log',
        },
      ],
    });

    reservedIDs = { nodes: ['n01', 'n02'], edges: ['e01'] };

    const {
      querySuccess: querySuccess1,
      queryHadResults: queryHadResults1,
      mergedResults: mergedResults1,
      creativeLimitHit: creativeLimitHit1,
    } = inferredQueryHandler.combineResponse(2, trapiQueryHandler1, qEdge, combinedResponse, reservedIDs);

    expect(reservedIDs.nodes).toContain('n03');

    expect(querySuccess1).toBeTruthy();
    expect(queryHadResults1).toBeTruthy();
    expect(Object.keys(mergedResults1)).toHaveLength(1);
    expect(creativeLimitHit1).toBeTruthy();
    expect(combinedResponse.message.results['fakeCompound1-fakeDisease1'].score).toEqual(1);
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
                ids: ['fakeDisease1'],
              },
            },
            edges: {
              e01: {
                subject: 'creativeQuerySubject',
                object: 'creativeQueryObject',
                predicates: ['biolink:treats'],
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
                knowledge_type: 'inferred',
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
    const queryIsValid = jest.spyOn(InferredQueryHandler.prototype, 'queryIsValid', 'get');
    const getQueryParts = jest.spyOn(InferredQueryHandler.prototype, 'getQueryParts');
    const findTemplates = jest.spyOn(InferredQueryHandler.prototype, 'findTemplates');
    const createQueries = jest.spyOn(InferredQueryHandler.prototype, 'createQueries');
    const combineResponse = jest.spyOn(InferredQueryHandler.prototype, 'combineResponse');
    const pruneKnowledgeGraph = jest.spyOn(InferredQueryHandler.prototype, 'pruneKnowledgeGraph');

    const parentHandler = new TRAPIQueryHandler();

    const handler = new InferredQueryHandler(
      parentHandler,
      TRAPIQueryHandler,
      {
        nodes: {
          creativeQuerySubject: {
            categories: ['biolink:SmallMolecule'],
          },
          creativeQueryObject: {
            categories: ['biolink:Disease'],
            ids: ['fakeDisease1'],
          },
        },
        edges: {
          e0: {
            subject: 'creativeQuerySubject',
            object: 'creativeQueryObject',
            predicates: ['biolink:treats'],
            knowledge_type: 'inferred',
          },
        },
      },
      [],
      {},
      smartAPIPAth,
      predicatesPath,
      true,
    );
    handler.CREATIVE_LIMIT = 1;

    const response = await handler.query();

    expect(queryIsValid).toHaveBeenCalled();
    expect(getQueryParts).toHaveBeenCalled();
    expect(findTemplates).toHaveBeenCalled();
    expect(createQueries).toHaveBeenCalled();
    expect(combineResponse).toHaveBeenCalled();
    expect(pruneKnowledgeGraph).toHaveBeenCalled();

    expect(response).toBeTruthy();
    expect(Object.keys(response.logs).length).toBeGreaterThan(0);
    expect(response.message.results).toHaveLength(1);
    expect(response.message.knowledge_graph.edges).toHaveProperty('edgeHash1');
    expect(response.message.knowledge_graph.nodes).toHaveProperty('creativeQuerySubject');
    expect(response.message.knowledge_graph.nodes).toHaveProperty('creativeQueryObject');
    expect(response.message.results[0].node_bindings).toHaveProperty('creativeQuerySubject');
    expect(response.message.results[0].node_bindings).toHaveProperty('creativeQueryObject');
    expect(response.logs.map(log => log.message)).toContain('Addition of 1 results from Template 0 meets creative result maximum of 1 (reaching 1 merged). Response will be truncated to top-scoring 1 results. Skipping remaining 2 templates.')
  });

  test('supportedLookups', async () => {
    const { supportedLookups } = require('../../src/inferred_mode/template_lookup');
    const supported = await supportedLookups();
    expect(supported).toContain('biolink:Drug-biolink:treats-biolink:Disease');
    expect(supported).toContain('biolink:SmallMolecule-biolink:treats-biolink:PhenotypicFeature');
    expect(supported.length).toBeGreaterThanOrEqual(5 * 2 * 3);
  });
});
