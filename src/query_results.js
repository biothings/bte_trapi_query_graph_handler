const { isEqual, cloneDeep, keys, toPairs, values, zipObject } = require('lodash');
const GraphHelper = require('./helper');
const helper = new GraphHelper();
const utils = require('./utils');
const debug = require('debug')('bte:biothings-explorer-trapi:QueryResult');

/**
 * @typedef {
 *   $edge_metadata: Object<string, *>,
 *   publications: string[],
 *   relation: string,
 *   source: string,
 *   score: number,
 *   $input: Object<string, *>,
 *   $output: Object<string, *>
 * } Record
 *
 * @typedef {
 *   connected_to: string[],
 *   records: Record[]
 * } EdgeData
 *
 * @typedef {string} QueryEdgeID
 *
 * @typedef {Object.<string, EdgeData>} DataByEdge
 *
 * @typedef {
 *   id: string,
 * } NodeBinding
 *
 * @typedef {
 *   id: string,
 * } EdgeBinding
 *
 * @typedef {
 *   node_bindings: Object.<string, NodeBinding[]>,
 *   edge_bindings: Object.<string, EdgeBinding[]>,
 *   score: number
 * } Result
 */

// TODO: if this is correct, it should probably be moved to helper.js
function _getInputIsSet(record) {
  return record.$edge_metadata.trapi_qEdge_obj.isReversed()
    ? record.$output.obj[0].is_set
    : record.$input.obj[0].is_set;
}

/**
 * Assemble a list of query results.
 *
 * When we query a bte-trapi server, we see this list
 * in the response as message.results.
 *
 * This class could be renamed something like QueryResultsHandler,
 * because when you create an instance and update it, the actual
 * query results are stored in the _results property.
 */
module.exports = class QueryResult {
  /**
   * Create a QueryResult instance.
   */
  constructor() {
    /**
     * @property {Result[]} _results - list of query results
     * @private
     */
    this._results = [];
  }

  getResults() {
    return this._results;
  }

  // NOTE: if we want to handle cycles, we'll probably need to keep track of what's been visited
  // But since Andrew said we don't have to worry about cycles for now, we're skipping that.
  _getPreresults(
    dataByEdge,
    queryEdgeID,
    edgeCount,
    preresults,
    preresult,
    queryNodeIDToMatch,
    primaryIDToMatch
  ) {
    const {connected_to, records} = dataByEdge[queryEdgeID];

    // queryNodeID example: 'n0'
    const inputQueryNodeID = helper._getInputQueryNodeID(records[0]);
    const outputQueryNodeID = helper._getOutputQueryNodeID(records[0]);

    let otherQueryNodeID, getMatchingPrimaryID, getOtherPrimaryID;

    if ([inputQueryNodeID, undefined].indexOf(queryNodeIDToMatch) > -1) {
      queryNodeIDToMatch = inputQueryNodeID;
      otherQueryNodeID = outputQueryNodeID;
      getMatchingPrimaryID = helper._getInputID;
      getOtherPrimaryID = helper._getOutputID;
    } else if (queryNodeIDToMatch === outputQueryNodeID) {
      otherQueryNodeID = inputQueryNodeID;
      getMatchingPrimaryID = helper._getOutputID;
      getOtherPrimaryID = helper._getInputID;
    } else {
      return;
    }

    const preresultClone = cloneDeep(preresult);

    records.filter((record) => {
      return [getMatchingPrimaryID(record), undefined].indexOf(primaryIDToMatch) > -1 ;
    }).forEach((record, i) => {
      // primaryID example: 'NCBIGene:1234'
      const matchingPrimaryID = getMatchingPrimaryID(record);
      const otherPrimaryID = getOtherPrimaryID(record);

      if (i !== 0) {
        preresult = cloneDeep(preresultClone);
      }

      preresult.push({
        inputQueryNodeID: helper._getInputQueryNodeID(record),
        outputQueryNodeID: helper._getOutputQueryNodeID(record),
        inputPrimaryID: helper._getInputID(record),
        outputPrimaryID: helper._getOutputID(record),
        queryEdgeID: queryEdgeID,
        kgEdgeID: helper._getKGEdgeID(record),
      });

      if (preresult.length == edgeCount) {
        preresults.push(preresult);
      }

      connected_to.forEach((connectedQueryEdgeID, j) => {
        this._getPreresults(
          dataByEdge,
          connectedQueryEdgeID,
          edgeCount,
          preresults,
          preresult,
          otherQueryNodeID,
          otherPrimaryID
        );
      });
    });
  }

  /**
   * Transform a collection of records into query result(s).
   * Cache the result(s) so they're ready for getResults().
   *
   * With the new generalized query handling, we can safely
   * assume every call to update contains all the records.
   *
   * @param {DataByEdge} dataByEdge
   * @return {undefined} nothing returned; just cache this._results
   */
  update(dataByEdge) {
    debug(`Updating query results now!`);
    this._results = [];

    // verify there are no empty records
    // TODO: with the new generalized query handling
    // is this check needed any more?
    let noRecords = false;
    values(dataByEdge).some(({records}) => {
      if (!records || records.length === 0) {
        debug(`at least one query edge has no records`);

        noRecords = true;

        // this is like calling break in a for loop
        return true;
      }
    });

    // If any query node is empty, there will be no results, so we can skip
    // any further processing. Every query node in commonPrimaryIDsByQueryNodeID
    // must have at least one primary ID
    if (noRecords) {
      return;
    }

    const edges = new Set(keys(dataByEdge));
    const edgeCount = edges.size;

    // NOTE: is_set in the query graph and the JavaScript Set object below refer to different sets.
    const queryNodeIDsWithIsSet = new Set();

    const queryNodeIDs = new Set();
    toPairs(dataByEdge).forEach(([queryEdgeID, {connected_to, records}]) => {
      const inputQueryNodeID = helper._getInputQueryNodeID(records[0]);
      const outputQueryNodeID = helper._getOutputQueryNodeID(records[0]);

      queryNodeIDs.add(inputQueryNodeID);
      queryNodeIDs.add(outputQueryNodeID);

      if (_getInputIsSet(records[0])) {
        queryNodeIDsWithIsSet.add(inputQueryNodeID)
      }
    });

    let initialQueryEdgeID, initialQueryNodeIDToMatch;
    toPairs(dataByEdge).some(([queryEdgeID, {connected_to, records}]) => {
      const inputQueryNodeID = helper._getInputQueryNodeID(records[0]);
      const outputQueryNodeID = helper._getOutputQueryNodeID(records[0]);

      if (connected_to.length === 0) {
        initialQueryEdgeID = queryEdgeID;
        initialQueryNodeIDToMatch = inputQueryNodeID;
      } else {
        connected_to.some((c) => {
          const nextEdge = dataByEdge[c];
          const inputQueryNodeID1 = helper._getInputQueryNodeID(nextEdge.records[0]);
          const outputQueryNodeID1 = helper._getOutputQueryNodeID(nextEdge.records[0]);
          if (!initialQueryEdgeID) {
            if ([inputQueryNodeID1, outputQueryNodeID1].indexOf(inputQueryNodeID) === -1) {
              initialQueryEdgeID = queryEdgeID;
              initialQueryNodeIDToMatch = inputQueryNodeID;

              // like calling break in a loop
              return true;
            } else if ([outputQueryNodeID1, outputQueryNodeID1].indexOf(outputQueryNodeID) === -1) {
              initialQueryEdgeID = queryEdgeID;
              initialQueryNodeIDToMatch = outputQueryNodeID;

              // like calling break in a loop
              return true;
            }
          }
        });

        if (initialQueryEdgeID) {
          // like calling break in a loop
          return true;
        }
      }
    });

    // 'preresult' just means it has the data needed to assemble a result,
    // but it's formatted differently for easier pre-processing.
    const preresults = [];
    this._getPreresults(
      dataByEdge,
      initialQueryEdgeID,
      edgeCount,
      preresults,
      [], // first preresult
      initialQueryNodeIDToMatch,
    );

    // there are two cases where we get more preresults than results and need to consolidate:
    // 1. one or more query nodes have param `is_set: true`
    // 2. one or more edges have multiple predicates each
    const consolidatedPreresults = [];
    const inputPrimaryIDsByInputQueryNodeID = {};
    const kgEdgeIDsByQueryEdgeID = {};
    let kgEdgeIDsByPreresultRecordID = {};

    preresults.forEach((preresult) => {
      let consolidatedPreresult = [];

      // a preresultRecord is basically the information from a record,
      // but formatted differently for purposes of assembling results.
      let preresultRecord = {
        inputPrimaryIDs: new Set(),
        outputPrimaryIDs: new Set(),
        kgEdgeIDs: new Set(),
      };

      const preresultRecordClone = cloneDeep(preresultRecord);

      if (preresult.length > 1) {
        kgEdgeIDsByPreresultRecordID = {};
      }

      preresult.forEach(({
        inputQueryNodeID, outputQueryNodeID,
        inputPrimaryID, outputPrimaryID,
        queryEdgeID, kgEdgeID
      }) => {

        // this is a unique identifier to represent a record, but
        // ignores details like predicates.
        const preresultRecordID = [
          inputQueryNodeID,
          inputPrimaryID,
          outputQueryNodeID,
          outputPrimaryID
        ].join("-");

        if (queryNodeIDsWithIsSet.has(inputQueryNodeID)) {
          if (!inputPrimaryIDsByInputQueryNodeID.hasOwnProperty(inputQueryNodeID)) {
            preresultRecord = cloneDeep(preresultRecordClone);
            consolidatedPreresult.push(preresultRecord);
            kgEdgeIDsByQueryEdgeID[queryEdgeID] = new Set();
            preresultRecord.kgEdgeIDs = kgEdgeIDsByQueryEdgeID[queryEdgeID];

            inputPrimaryIDsByInputQueryNodeID[inputQueryNodeID] = new Set();
            preresultRecord.inputPrimaryIDs = inputPrimaryIDsByInputQueryNodeID[inputQueryNodeID];
          }

          inputPrimaryIDsByInputQueryNodeID[inputQueryNodeID].add(inputPrimaryID);
          kgEdgeIDsByQueryEdgeID[queryEdgeID].add(kgEdgeID);
        } else {
          if (kgEdgeIDsByPreresultRecordID.hasOwnProperty(preresultRecordID)) {
            kgEdgeIDsByPreresultRecordID[preresultRecordID].add(kgEdgeID);
          } else {
            kgEdgeIDsByPreresultRecordID[preresultRecordID] = new Set([kgEdgeID]);
            preresultRecord = cloneDeep(preresultRecordClone);
            consolidatedPreresult.push(preresultRecord);
            preresultRecord.kgEdgeIDs = kgEdgeIDsByPreresultRecordID[preresultRecordID];
            preresultRecord.inputPrimaryIDs.add(inputPrimaryID);
          }
        }

        preresultRecord.outputPrimaryIDs.add(outputPrimaryID);

        preresultRecord.inputQueryNodeID = inputQueryNodeID;
        preresultRecord.outputQueryNodeID = outputQueryNodeID;
        preresultRecord.queryEdgeID = queryEdgeID;
      });

      if (consolidatedPreresult.length === edgeCount) {
        consolidatedPreresults.push(consolidatedPreresult);
        consolidatedPreresult = [];
      }
    });

    this._results = consolidatedPreresults.map((consolidatedPreresult) => {

      // TODO: calculate an actual score
      const result = {node_bindings: {}, edge_bindings: {}, score: 1.0};

      consolidatedPreresult.forEach(({
        inputQueryNodeID, outputQueryNodeID,
        inputPrimaryIDs, outputPrimaryIDs,
        queryEdgeID, kgEdgeIDs
      }) => {
        result.node_bindings[inputQueryNodeID] = Array.from(inputPrimaryIDs).map(inputPrimaryID => {
          return {
            id: inputPrimaryID
          };
        });

        result.node_bindings[outputQueryNodeID] = Array.from(outputPrimaryIDs).map(outputPrimaryID => {
          return {
            id: outputPrimaryID
          };
        });

        const edge_bindings = result.edge_bindings[queryEdgeID] = Array.from(kgEdgeIDs).map((kgEdgeID) => {
          return {
            id: kgEdgeID
          };
        });
      });

      return result;
    });
  }
};
