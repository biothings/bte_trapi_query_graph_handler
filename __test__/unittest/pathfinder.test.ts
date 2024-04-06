import TRAPIQueryHandler, { TrapiQueryGraph, TrapiResponse } from '../../src/index';
import path from 'path';
import fs from 'fs';
import _ from 'lodash';
import Pathfinder from '../../src/inferred_mode/pathfinder';

const queryGraph1 = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/chemical_to_disease_pathfinder.json'), { encoding: 'utf8' }),
).message.query_graph as TrapiQueryGraph;

const creativeResult1 = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../data/chemical_to_disease_pf_creative_result.json'), { encoding: 'utf8' }),
) as TrapiResponse;
  

describe('Test Pathfinder', () => {
  test('Query Validation', () => {
    const missingID = _.cloneDeep(queryGraph1);
    missingID.nodes['n2'].ids = [];

    const queryGraphHandler = new TRAPIQueryHandler();
    queryGraphHandler.setQueryGraph(missingID);
    expect(queryGraphHandler._queryIsPathfinder()).toBeFalsy();

    const missingEdge = _.cloneDeep(queryGraph1);
    delete missingEdge.edges.e1;

    queryGraphHandler.setQueryGraph(missingEdge);
    expect(queryGraphHandler._queryIsPathfinder()).toBeFalsy();

    const missingInferred = _.cloneDeep(queryGraph1);
    delete missingInferred.edges.e1.knowledge_type;

    queryGraphHandler.setQueryGraph(missingInferred);
    expect(queryGraphHandler._queryIsPathfinder()).toBeFalsy();

    const swappedSubjObj = _.cloneDeep(queryGraph1);
    const temp = swappedSubjObj.edges.e1.subject;
    swappedSubjObj.edges.e1.subject = swappedSubjObj.edges.e1.object;
    swappedSubjObj.edges.e1.object = temp;

    queryGraphHandler.setQueryGraph(swappedSubjObj);
    const pfHandler1 = new Pathfinder([], swappedSubjObj, queryGraphHandler);
    expect(queryGraphHandler._queryIsPathfinder()).toBeTruthy();
    expect(pfHandler1.extractData()).toBeTruthy(); // string = error

    queryGraphHandler.setQueryGraph(queryGraph1);
    const pfHandler2 = new Pathfinder([], queryGraph1, queryGraphHandler);
    expect(queryGraphHandler._queryIsPathfinder()).toBeTruthy();
    expect(pfHandler2.extractData()).toBeFalsy();
  });

  test('extractData', () => {
    const queryGraphHandler = new TRAPIQueryHandler();
    queryGraphHandler.setQueryGraph(queryGraph1);
    const pfHandler = new Pathfinder([], queryGraph1, queryGraphHandler);
    pfHandler.extractData();

    expect(pfHandler.intermediateEdges[0][0]).toEqual('e0');
    expect(pfHandler.intermediateEdges[1][0]).toEqual('e1');
    expect(pfHandler.unpinnedNodeId).toEqual('un');
    expect(pfHandler.mainEdgeId).toEqual('e2');
  });

  test('parse', () => {
    const queryGraphHandler = new TRAPIQueryHandler();
    queryGraphHandler.setQueryGraph(queryGraph1);
    const pfHandler = new Pathfinder([], queryGraph1, queryGraphHandler);
    pfHandler.extractData();
    const pfResponse = pfHandler.parse(creativeResult1);

    expect(pfResponse.message.results.length).toEqual(500);
    expect(Object.keys(pfResponse.message.auxiliary_graphs!).length).toEqual(2363);

    const n0 = pfResponse.message.results[0].node_bindings['n0'][0].id;
    const un = pfResponse.message.results[0].node_bindings['un'][0].id;
    const n2 = pfResponse.message.results[0].node_bindings['n2'][0].id;

    const n0ToUn = pfResponse.message.results[0].analyses[0].edge_bindings['e0'][0].id;
    const unToN2 = pfResponse.message.results[0].analyses[0].edge_bindings['e1'][0].id;
    const n0ToN2 = pfResponse.message.results[0].analyses[0].edge_bindings['e2'][0].id;

    // check nodes on edges
    expect(pfResponse.message.knowledge_graph.edges[n0ToUn].subject).toEqual(n0);
    expect(pfResponse.message.knowledge_graph.edges[n0ToUn].object).toEqual(un);
    expect(pfResponse.message.knowledge_graph.edges[unToN2].subject).toEqual(un);
    expect(pfResponse.message.knowledge_graph.edges[unToN2].object).toEqual(n2);
    expect(pfResponse.message.knowledge_graph.edges[n0ToN2].subject).toEqual(n0);
    expect(pfResponse.message.knowledge_graph.edges[n0ToN2].object).toEqual(n2);

    // check that aux graphs are correct
    const n0ToUnAux = pfResponse.message.knowledge_graph.edges[n0ToUn].attributes?.find(s => s.attribute_type_id === 'biolink:support_graphs')?.value as string;
    const unToN2Aux = pfResponse.message.knowledge_graph.edges[unToN2].attributes?.find(s => s.attribute_type_id === 'biolink:support_graphs')?.value as string;
    const n0ToN2Aux = pfResponse.message.knowledge_graph.edges[n0ToN2].attributes?.find(s => s.attribute_type_id === 'biolink:support_graphs')?.value as string;

    expect(pfResponse.message.auxiliary_graphs![n0ToN2Aux].edges.sort()).toEqual([...pfResponse.message.auxiliary_graphs![n0ToUnAux].edges, ...pfResponse.message.auxiliary_graphs![unToN2Aux].edges].sort());
  });
});
