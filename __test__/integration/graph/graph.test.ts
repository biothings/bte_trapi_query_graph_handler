import graph from '../../../src/graph/graph';
import { Record } from '@biothings-explorer/api-response-transform';

describe('Test graph class', () => {
  const qNode1 = {
    getID() {
      return 'qg1';
    },
  };
  const qNode2 = {
    getID() {
      return 'qg2';
    },
  };
  const record1 = new Record({
    api: 'API1',
    metaEdgeSource: 'source1',
    apiInforesCurie: 'infores:API1',
    predicate: 'predicate1',
    object: {
      qNodeID: 'qg2',
      curie: 'outputPrimaryCurie',
      original: 'outputPrimaryCurie',
    },
    subject: {
      qNodeID: 'qg1',
      curie: 'inputPrimaryCurie',
      original: 'inputPrimaryCurie',
    },
    publications: ['PMID:1', 'PMID:2'],
    mappedResponse: {
      relation: 'relation1',
    },
  });

  const record2 = new Record({
    api: 'API2',
    metaEdgeSource: 'source2',
    apiInforesCurie: 'infores:API2',
    predicate: 'predicate1',
    object: {
      qNodeID: 'qg2',
      curie: 'outputPrimaryCurie',
      original: 'outputPrimaryCurie',
    },
    subject: {
      qNodeID: 'qg1',
      curie: 'inputPrimaryCurie',
      original: 'inputPrimaryCurie',
    },
    publications: ['PMC:1', 'PMC:2'],
    mappedResponse: {
      relation: 'relation2',
    },
  });

  const record3 = new Record({
    api: 'API3',
    metaEdgeSource: 'source3',
    apiInforesCurie: 'infores:API3',
    predicate: 'predicate2',
    object: {
      qNodeID: 'qg2',
      curie: 'outputPrimaryCurie',
      original: 'outputPrimaryCurie',
    },
    subject: {
      qNodeID: 'qg1',
      curie: 'inputPrimaryCurie',
      original: 'inputPrimaryCurie',
    },
    publications: ['PMC:3', 'PMC:4'],
    mappedResponse: {
      relation: 'relation3',
    },
  });

  const record3a = new Record({
    api: 'API3',
    metaEdgeSource: 'source3',
    apiInforesCurie: 'infores:API3',
    predicate: 'predicate2',
    object: {
      qNodeID: 'qg2',
      curie: 'outputPrimaryCurie',
      original: 'outputPrimaryCurie',
    },
    subject: {
      qNodeID: 'qg1',
      curie: 'inputPrimaryCurie',
      original: 'inputPrimaryCurie',
    },
    publications: ['PMC:6', 'PMC:7'],
    mappedResponse: {
      relation: ['relation3a', 'relation3b'],
    },
  });

  test('A single query result is correctly updated.', () => {
    const g = new graph();
    g.update([record1]);
    expect(g.nodes).toHaveProperty('outputPrimaryCurie');
    expect(g.nodes).toHaveProperty('inputPrimaryCurie');
    expect(g.nodes['outputPrimaryCurie'].primaryCurie).toEqual('outputPrimaryCurie');
    expect(g.nodes['outputPrimaryCurie'].qNodeID).toEqual('qg2');
    expect(Array.from(g.nodes['outputPrimaryCurie'].sourceNodes)).toEqual(['inputPrimaryCurie']);
    expect(Array.from(g.nodes['outputPrimaryCurie'].sourceQNodeIDs)).toEqual(['qg1']);
    expect(g.nodes['inputPrimaryCurie'].primaryCurie).toEqual('inputPrimaryCurie');
    expect(g.nodes['inputPrimaryCurie'].qNodeID).toEqual('qg1');
    expect(Array.from(g.nodes['inputPrimaryCurie'].targetNodes)).toEqual(['outputPrimaryCurie']);
    expect(Array.from(g.nodes['inputPrimaryCurie'].targetQNodeIDs)).toEqual(['qg2']);
    expect(g.edges).toHaveProperty('3eb29a4cead0e5f3c3bdca4997bf215b');
    expect(Array.from(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].apis)).toEqual(['API1']);
    expect(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].sources).toHaveProperty('source1');
    expect(Array.from(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].publications)).toEqual(['PMID:1', 'PMID:2']);
    expect(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].attributes).toHaveProperty('relation', ['relation1']);
  });

  test('Multiple query results are correctly updated for two edges having same input, predicate and output', () => {
    const g = new graph();
    g.update([record1, record2]);
    expect(g.nodes).toHaveProperty('outputPrimaryCurie');
    expect(g.nodes).toHaveProperty('inputPrimaryCurie');
    expect(g.nodes['outputPrimaryCurie'].primaryCurie).toEqual('outputPrimaryCurie');
    expect(g.nodes['outputPrimaryCurie'].qNodeID).toEqual('qg2');
    expect(Array.from(g.nodes['outputPrimaryCurie'].sourceNodes)).toEqual(['inputPrimaryCurie']);
    expect(Array.from(g.nodes['outputPrimaryCurie'].sourceQNodeIDs)).toEqual(['qg1']);
    expect(g.nodes['inputPrimaryCurie'].primaryCurie).toEqual('inputPrimaryCurie');
    expect(g.nodes['inputPrimaryCurie'].qNodeID).toEqual('qg1');
    expect(Array.from(g.nodes['inputPrimaryCurie'].targetNodes)).toEqual(['outputPrimaryCurie']);
    expect(Array.from(g.nodes['inputPrimaryCurie'].targetQNodeIDs)).toEqual(['qg2']);

    expect(g.edges).toHaveProperty('3eb29a4cead0e5f3c3bdca4997bf215b');
    expect(Array.from(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].apis)).toEqual(['API1']);
    expect(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].sources).toHaveProperty('source1');
    expect(Array.from(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].publications)).toEqual(['PMID:1', 'PMID:2']);
    expect(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].attributes).toHaveProperty('relation', ['relation1']);

    expect(g.edges).toHaveProperty('6930dcb2e9363817e9f6e736829ce278');
    expect(Array.from(g.edges['6930dcb2e9363817e9f6e736829ce278'].apis)).toEqual(['API2']);
    expect(g.edges['6930dcb2e9363817e9f6e736829ce278'].sources).toHaveProperty('source2');
    expect(Array.from(g.edges['6930dcb2e9363817e9f6e736829ce278'].publications)).toEqual(['PMC:1', 'PMC:2']);
    expect(g.edges['6930dcb2e9363817e9f6e736829ce278'].attributes).toHaveProperty('relation', ['relation2']);
  });

  test('Multiple query results for different edges are correctly updated', () => {
    const g = new graph();
    g.update([record1, record2, record3]);
    expect(g.nodes).toHaveProperty('outputPrimaryCurie');
    expect(g.nodes).toHaveProperty('inputPrimaryCurie');
    expect(g.nodes['outputPrimaryCurie'].primaryCurie).toEqual('outputPrimaryCurie');
    expect(g.nodes['outputPrimaryCurie'].qNodeID).toEqual('qg2');
    expect(Array.from(g.nodes['outputPrimaryCurie'].sourceNodes)).toEqual(['inputPrimaryCurie']);
    expect(Array.from(g.nodes['outputPrimaryCurie'].sourceQNodeIDs)).toEqual(['qg1']);
    expect(g.nodes['inputPrimaryCurie'].primaryCurie).toEqual('inputPrimaryCurie');
    expect(g.nodes['inputPrimaryCurie'].qNodeID).toEqual('qg1');
    expect(Array.from(g.nodes['inputPrimaryCurie'].targetNodes)).toEqual(['outputPrimaryCurie']);
    expect(Array.from(g.nodes['inputPrimaryCurie'].targetQNodeIDs)).toEqual(['qg2']);

    expect(g.edges).toHaveProperty('3eb29a4cead0e5f3c3bdca4997bf215b');
    expect(Array.from(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].apis)).toEqual(['API1']);
    expect(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].sources).toHaveProperty('source1');
    expect(Array.from(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].publications)).toEqual(['PMID:1', 'PMID:2']);
    expect(g.edges['3eb29a4cead0e5f3c3bdca4997bf215b'].attributes).toHaveProperty('relation', ['relation1']);

    expect(g.edges).toHaveProperty('6930dcb2e9363817e9f6e736829ce278');
    expect(Array.from(g.edges['6930dcb2e9363817e9f6e736829ce278'].apis)).toEqual(['API2']);
    expect(g.edges['6930dcb2e9363817e9f6e736829ce278'].sources).toHaveProperty('source2');
    expect(Array.from(g.edges['6930dcb2e9363817e9f6e736829ce278'].publications)).toEqual(['PMC:1', 'PMC:2']);
    expect(g.edges['6930dcb2e9363817e9f6e736829ce278'].attributes).toHaveProperty('relation', ['relation2']);

    expect(g.edges).toHaveProperty('38e8cf1917452c83bb878c5a916ef86a');
    expect(Array.from(g.edges['38e8cf1917452c83bb878c5a916ef86a'].apis)).toEqual(['API3']);
    expect(g.edges['38e8cf1917452c83bb878c5a916ef86a'].sources).toHaveProperty('source3');
    expect(Array.from(g.edges['38e8cf1917452c83bb878c5a916ef86a'].publications)).toEqual(['PMC:3', 'PMC:4']);
    expect(g.edges['38e8cf1917452c83bb878c5a916ef86a'].attributes).toHaveProperty('relation', ['relation3']);
  });

  test('Multiple attributes with the same name are merged', () => {
    const g = new graph();
    g.update([record3, record3a]);

    expect(g.edges).toHaveProperty('38e8cf1917452c83bb878c5a916ef86a');
    expect(Array.from(g.edges['38e8cf1917452c83bb878c5a916ef86a'].publications)).toEqual([
      'PMC:3',
      'PMC:4',
      'PMC:6',
      'PMC:7',
    ]);
    expect(g.edges['38e8cf1917452c83bb878c5a916ef86a'].attributes).toHaveProperty('relation', [
      'relation3',
      'relation3a',
      'relation3b',
    ]);
  });
});
