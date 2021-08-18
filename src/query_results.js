const { head, keys, toPairs, zipObject } = require('lodash');
const GraphHelper = require('./helper');
const helper = new GraphHelper();
const debug = require('debug')('bte:biothings-explorer-trapi:QueryResult');

module.exports = class QueryResult {
  constructor() {
    this.results = [];
  }

  getResults() {
    return this.results;
  }

  _getIntersectingPrimaryIDsByNode(dataByEdge, singleEdgeData, seenEdges=new Set()) {
    const [queryEdgeID, {connected_to, records}] = singleEdgeData;
    if (!records || records.length === 0) {
      debug(`queryResult._getIntersectingPrimaryIDsByNode: records empty`);
      return;
    }
    const {intersectingPrimaryIDsByNode} = this;

    if (seenEdges.has(queryEdgeID)) {
      return;
    }
    seenEdges.add(queryEdgeID);

    const inputQueryNodeID = helper._getInputQueryNodeID(records[0]);
    const outputQueryNodeID = helper._getOutputQueryNodeID(records[0]);

    // primary IDs like NCBI:1234
    const inputPrimaryIDs = new Set(records.map(record => {
      return helper._getInputID(record);
    }));
    const outputPrimaryIDs = new Set(records.map(record => {
      return helper._getOutputID(record);
    }));

    if (!intersectingPrimaryIDsByNode[inputQueryNodeID]) {
      intersectingPrimaryIDsByNode[inputQueryNodeID] = inputPrimaryIDs;
    } else {
      intersectingPrimaryIDsByNode[inputQueryNodeID] = helper._intersection(
        intersectingPrimaryIDsByNode[inputQueryNodeID], inputPrimaryIDs
      );
    }

    if (!intersectingPrimaryIDsByNode[outputQueryNodeID]) {
      intersectingPrimaryIDsByNode[outputQueryNodeID] = outputPrimaryIDs;
    } else {
      intersectingPrimaryIDsByNode[outputQueryNodeID] = helper._intersection(
        intersectingPrimaryIDsByNode[outputQueryNodeID], outputPrimaryIDs
      );
    }

    connected_to.forEach((adjacentQueryEdgeID) => {
      this._getIntersectingPrimaryIDsByNode(
        dataByEdge,
        [adjacentQueryEdgeID, dataByEdge[adjacentQueryEdgeID]],
        seenEdges
      )
    });
  }

  /* With the new generalized query handling, we can safely assume every
   * call to update contains all the records.
   */
  update(dataByEdge) {
    debug(`Updating query results now!`);
    this.intersectingPrimaryIDsByNode = {};
    this.results = [];

    const firstEdgeData = head(toPairs(dataByEdge));
    if (!firstEdgeData) {
      return;
    }

    this._getIntersectingPrimaryIDsByNode(dataByEdge, firstEdgeData);

    const queryNodeIDs = [];
    const primaryIDLists = [];
    toPairs(this.intersectingPrimaryIDsByNode)
      .forEach(([queryNodeID, primaryNodeIDs]) => {
        queryNodeIDs.push(queryNodeID);
        primaryIDLists.push(Array.from(primaryNodeIDs))
      });

    const edgeCount = keys(dataByEdge).length;

    this.results = helper._cartesian(primaryIDLists)
      .map(combo => {
        return zipObject(queryNodeIDs, combo);
      })
      .map((labeledCombo) => {
        const validEdges = toPairs(dataByEdge)
          .map(([queryEdgeID, {connected_to, records}]) => {
            const validRecords = records.filter((record) => {
              const inputQueryNodeID = helper._getInputQueryNodeID(record);
              const outputQueryNodeID = helper._getOutputQueryNodeID(record);

              const inputPrimaryID = helper._getInputID(record);
              const outputPrimaryID = helper._getOutputID(record);

              return (labeledCombo[inputQueryNodeID] == inputPrimaryID) &&
                (labeledCombo[outputQueryNodeID] == outputPrimaryID);
            });

            return {
              queryEdgeID,
              validRecords
            };
          })
          .filter(({queryEdgeID, validRecords}) => {
            return validRecords.length === 1;
          })
          .map(({queryEdgeID, validRecords}) => {
            return {queryEdgeID, record: validRecords[0]};
          });

        return validEdges;
      })
      .filter(validEdges => {
        return validEdges.length === edgeCount;
      })
      .map(validEdges => {
        //default score issue #200 - TODO: turn to evaluating module eventually
        const result = {node_bindings: {}, edge_bindings: {}, score: '1.0'};
        validEdges.forEach(({queryEdgeID, record}) => {
          const inputQueryNodeID = helper._getInputQueryNodeID(record);
          const outputQueryNodeID = helper._getOutputQueryNodeID(record);

          const inputPrimaryID = helper._getInputID(record);
          const outputPrimaryID = helper._getOutputID(record);

          // NOTE: except for the first time, the following will already be set,
          //       but it shouldn't matter if we set it again to the same value.
          result.node_bindings[inputQueryNodeID] = [
            {
              id: inputPrimaryID
            },
          ];

          result.node_bindings[outputQueryNodeID] = [
            {
              id: outputPrimaryID
            },
          ];
          result.edge_bindings[queryEdgeID] = [
            {
              id: helper._getKGEdgeID(record)
            },
          ];
        });
        return result;
      });
  }
};
