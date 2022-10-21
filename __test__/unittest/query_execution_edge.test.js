const QueryExecutionEdge = require('../../src/query_execution_edge');
const fs = require('fs');
const path = require('path');
const QEdge = require('../../src/query_edge');
const QNode = require('../../src/query_node');
const { Record } = require('@biothings-explorer/api-response-transform');
const _ = require('lodash');

const rebuildQEdge = (qEdgeJSON) => {
  const makeNodeInfo = (node) => {
    return {
      categories: node.category,
      ids: node.curie,
    };
  };

  const qEdgeSubjectInfo = makeNodeInfo(qEdgeJSON.subject);
  const qEdgeObjectInfo = makeNodeInfo(qEdgeJSON.object);
  qEdgeJSON.subject = new QNode(qEdgeJSON.subject.id, qEdgeSubjectInfo);
  qEdgeJSON.object = new QNode(qEdgeJSON.object.id, qEdgeObjectInfo);
  qEdgeJSON.predicates = qEdgeJSON.predicate;

  const qEdge = new QEdge(qEdgeJSON.id, qEdgeJSON);
  return qEdge;
};

const qEdgeJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/qEdge.json')));
const qEdge = rebuildQEdge(qEdgeJSON);

describe('test query execution edge', () => {
  test('qXEdge creation', () => {
    const qXEdge = new QueryExecutionEdge(qEdge, false);
    expect(qXEdge).not.toBeUndefined();
    expect(qXEdge.getID()).toEqual(qEdge.id);
    expect(qXEdge.isReversed()).toBeFalsy();
    expect(qXEdge.getSubject()).toEqual(qEdge.subject);
    expect(qXEdge.getObject()).toEqual(qEdge.object);
    expect(qXEdge.getInputNode()).toEqual(qEdge.subject);
    expect(qXEdge.getOutputNode()).toEqual(qEdge.object);
    expect(qXEdge.getInputCurie()).toEqual(['NCBIGene:7157']);
    expect(qXEdge.hasInput()).toBeTruthy();
  });

  test('qXEdge predicate expansion', () => {
    const qXEdge = new QueryExecutionEdge(qEdge, false);
    expect(qXEdge.getPredicate()).not.toHaveLength(1);
  });

  test('qXEdge reversing', () => {
    const qXEdge = new QueryExecutionEdge(qEdge, true);
    expect(qXEdge.isReversed()).toBeTruthy();
    expect(qXEdge.getSubject()).toEqual(qEdge.object);
    expect(qXEdge.getObject()).toEqual(qEdge.subject);
    expect(qXEdge.getPredicate().includes('caused_by'));
  });

  test('getReversedPredicate', () => {
    const qXEdge = new QueryExecutionEdge(qEdge, false);
    expect(qXEdge.getReversedPredicate('causes')).toEqual('caused_by');
  });

  test('getHashedEdgeRepresentation', () => {
    const qXEdge1 = new QueryExecutionEdge(qEdge, false);
    const qXEdge2 = new QueryExecutionEdge(qEdge, true);
    expect(qXEdge1.getHashedEdgeRepresentation()).not.toEqual(qXEdge2.getHashedEdgeRepresentation());
  });

  describe('chooseLowerEntityValue', () => {
    test('Should reverse if subject has more curies', () => {
      const qEdgeClone = _.cloneDeep(qEdge);
      qEdgeClone.subject.entity_count = 2;
      qEdgeClone.object.entity_count = 1;

      const qXEdge = new QueryExecutionEdge(qEdgeClone, false);
      qXEdge.chooseLowerEntityValue();

      expect(qXEdge.isReversed()).toBeTruthy();
    });

    test("Shouldn't reverse if object has more curies", () => {
      const qEdgeClone = _.cloneDeep(qEdge);
      qEdgeClone.subject.entity_count = 1;
      qEdgeClone.object.entity_count = 2;

      const qXEdge = new QueryExecutionEdge(qEdgeClone, false);
      qXEdge.chooseLowerEntityValue();

      expect(qXEdge.isReversed()).toBeFalsy();
    });

    test("Shouldn't reverse if both have same number", () => {
      const qEdgeClone = _.cloneDeep(qEdge);
      qEdgeClone.subject.entity_count = 2;
      qEdgeClone.object.entity_count = 2;

      const qXEdge = new QueryExecutionEdge(qEdgeClone, false);
      qXEdge.chooseLowerEntityValue();

      expect(qXEdge.isReversed()).toBeFalsy();
    });
  });

  // test('storeRecords', () => {
  // });

  // test('extractCuriesFromRecords', () => {
  // });

  // test('updateNodeCuries', () => {});
});
