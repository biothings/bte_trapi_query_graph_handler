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
  _getPrimaryIDByQueryNodeIDCombos(
    dataByEdge,
    queryEdgeID,
    briefRecordsByEdge,
    primaryIDByQueryNodeIDCombos,
    primaryIDByQueryNodeIDCombo,
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

    const primaryIDByQueryNodeIDComboClone = cloneDeep(primaryIDByQueryNodeIDCombo);
    records.filter((record) => {
      return [getMatchingPrimaryID(record), undefined].indexOf(primaryIDToMatch) > -1 ;
    }).forEach((record, i) => {
      // primaryID example: 'NCBIGene:1234'
      const matchingPrimaryID = getMatchingPrimaryID(record);
      const otherPrimaryID = getOtherPrimaryID(record);

      if (i !== 0) {
        primaryIDByQueryNodeIDCombo = cloneDeep(primaryIDByQueryNodeIDComboClone);
        primaryIDByQueryNodeIDCombos.push(primaryIDByQueryNodeIDCombo);
      }

      // Later on, we'll just need several IDs from each record,
      // not the entire record. Let's collect those ahead of time.
      if (!briefRecordsByEdge.hasOwnProperty(queryEdgeID)) {
        briefRecordsByEdge[queryEdgeID] = [];
      }
      briefRecordsByEdge[queryEdgeID].push({
        inputQueryNodeID: helper._getInputQueryNodeID(record),
        outputQueryNodeID: helper._getOutputQueryNodeID(record),
        inputPrimaryID: helper._getInputID(record),
        outputPrimaryID: helper._getOutputID(record),
        kgEdgeID: helper._getKGEdgeID(record),
      });

      primaryIDByQueryNodeIDCombo[queryNodeIDToMatch] = matchingPrimaryID;
      primaryIDByQueryNodeIDCombo[otherQueryNodeID] = otherPrimaryID;

      connected_to.forEach((connectedQueryEdgeID, j) => {
        this._getPrimaryIDByQueryNodeIDCombos(
          dataByEdge,
          connectedQueryEdgeID,
          briefRecordsByEdge,
          primaryIDByQueryNodeIDCombos,
          primaryIDByQueryNodeIDCombo,
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

    const queryNodeIDs = new Set();
    toPairs(dataByEdge).forEach((x) => {
      const [queryEdgeID, {connected_to, records}] = x;

      const inputQueryNodeID = helper._getInputQueryNodeID(records[0]);
      const outputQueryNodeID = helper._getOutputQueryNodeID(records[0]);

      queryNodeIDs.add(inputQueryNodeID);
      queryNodeIDs.add(outputQueryNodeID);
    });

    const primaryIDByQueryNodeIDCombos = [];
    const starter = {};
    primaryIDByQueryNodeIDCombos.push(starter)

    let starterQueryEdgeID, starterQueryNodeIDToMatch;
    toPairs(dataByEdge).some((x) => {
      const [queryEdgeID, {connected_to, records}] = x;

      const inputQueryNodeID = helper._getInputQueryNodeID(records[0]);
      const outputQueryNodeID = helper._getOutputQueryNodeID(records[0]);

      if (connected_to.length === 0) {
        starterQueryEdgeID = queryEdgeID;
        starterQueryNodeIDToMatch = inputQueryNodeID;
      } else {
        connected_to.some((c) => {
          const nextEdge = dataByEdge[c];
          const inputQueryNodeID1 = helper._getInputQueryNodeID(nextEdge.records[0]);
          const outputQueryNodeID1 = helper._getOutputQueryNodeID(nextEdge.records[0]);
          if (!starterQueryEdgeID) {
            if ([inputQueryNodeID1, outputQueryNodeID1].indexOf(inputQueryNodeID) === -1) {
              starterQueryEdgeID = queryEdgeID;
              starterQueryNodeIDToMatch = inputQueryNodeID;
              return true;
            } else if ([outputQueryNodeID1, outputQueryNodeID1].indexOf(outputQueryNodeID) === -1) {
              starterQueryEdgeID = queryEdgeID;
              starterQueryNodeIDToMatch = outputQueryNodeID;
              return true;
            }
          }
        });

        if (starterQueryEdgeID) {
          return true;
        }
      }
    });

    const briefRecordsByEdge = {};
    this._getPrimaryIDByQueryNodeIDCombos(
      dataByEdge,
      starterQueryEdgeID,
      briefRecordsByEdge,
      primaryIDByQueryNodeIDCombos,
      starter,
      starterQueryNodeIDToMatch
    );

    const queryNodeIDCount = Array.from(queryNodeIDs).length;
    const primaryIDByQueryNodeIDCombosStrings = new Set();
    const primaryIDByQueryNodeIDCombosFiltered = primaryIDByQueryNodeIDCombos.filter((primaryIDByQueryNodeIDCombo) => {
      const primaryIDByQueryNodeIDComboString = keys(primaryIDByQueryNodeIDCombo)
        .concat(values(primaryIDByQueryNodeIDCombo))
        .sort()
        .join("-");

      // remove duplicates
      if (primaryIDByQueryNodeIDCombosStrings.has(primaryIDByQueryNodeIDComboString)) {
        return false;
      } else {
        primaryIDByQueryNodeIDCombosStrings.add(primaryIDByQueryNodeIDComboString);
      }

      // remove incomplete combos
      return keys(primaryIDByQueryNodeIDCombo).length === queryNodeIDCount;
    });

    this._results = primaryIDByQueryNodeIDCombosFiltered
      // We've now identified all the valid combinations of primary IDs.
      // Next, let's go through the records again to start assembling results.
      .map((primaryIDByQueryNodeID) => {
        return toPairs(briefRecordsByEdge)
          .reduce((acc, [queryEdgeID, briefRecords]) => {
            const compatibleBriefRecords = briefRecords.filter(({
              inputQueryNodeID, outputQueryNodeID,
              inputPrimaryID, outputPrimaryID,
            }) => {
              return (primaryIDByQueryNodeID[inputQueryNodeID] == inputPrimaryID) &&
                (primaryIDByQueryNodeID[outputQueryNodeID] == outputPrimaryID);
            });

            // Because of the filter step above, every compatibleBriefRecord
            // in this batch will have the same values for:
            // inputQueryNodeID, outputQueryNodeID, inputPrimaryID, outputPrimaryID
            //
            // However, it is possible to have different values for kgEdgeID, so
            // let's put all of those into a set.
            const kgEdgeIDs = compatibleBriefRecords.reduce((acc, {kgEdgeID}) => {
              acc.add(kgEdgeID);
              return acc;
            }, new Set());

            acc[queryEdgeID] = {
              inputQueryNodeID: compatibleBriefRecords[0].inputQueryNodeID,
              outputQueryNodeID: compatibleBriefRecords[0].outputQueryNodeID,
              inputPrimaryID: compatibleBriefRecords[0].inputPrimaryID,
              outputPrimaryID: compatibleBriefRecords[0].outputPrimaryID,
              kgEdgeIDs
            };

            return acc;
          }, {})
      })
      /**
       * Assemble each query result.
       *
       * infoByEdgeForOneCombo represents one compatible combination of records.
       * This means a collection of records, one per query graph edge, all fit
       * together with each other with inputs and outputs connected
       * as specified by the query graph. But for convenience, instead of full
       * records, we're actually just working with the IDs we need, as collected
       * earlier.
       *
       * @param {Object.<QueryEdgeID, {
       *   inputQueryNodeID: string,
       *   outputQueryNodeID: string,
       *   inputPrimaryID: string,
       *   outputPrimaryID: string,
       *   kgEdgeIDs: Set.<string>
       * }>} infoByEdgeForOneCombo
       * @return {Result}
       */
      .map(infoByEdgeForOneCombo => {
        // default score issue #200 - TODO: turn to evaluating module eventually
        const result = {node_bindings: {}, edge_bindings: {}, score: 1.0};

        toPairs(infoByEdgeForOneCombo).forEach(([queryEdgeID, {
            inputQueryNodeID, outputQueryNodeID,
            inputPrimaryID, outputPrimaryID,
            kgEdgeIDs
          }], i) => {

          // NOTE: either or both of the following could have been set already
          // when we processed records for another query edge, but that's OK.
          //
          // When two records are linked, the outputPrimaryID for one record
          // will be the same as the inputPrimaryID for the other. Because of
          // that, whichever record was processed here first will have already
          // set the value for result.node_bindings[queryNodeID]. Because every
          // record in infoByEdgeForOneCombo uses the same mappings
          // from queryNodeID to primaryID, there is no conflict. The same logic
          // is also valid for the case of more than two linked records.
          if (!result.node_bindings.hasOwnProperty(inputQueryNodeID)) {
            result.node_bindings[inputQueryNodeID] = [
              {
                id: inputPrimaryID
              },
            ];
          }
          if (!result.node_bindings.hasOwnProperty(outputQueryNodeID)) {
            result.node_bindings[outputQueryNodeID] = [
              {
                id: outputPrimaryID
              },
            ];
          }

          const edge_bindings = result.edge_bindings[queryEdgeID] = [];
          kgEdgeIDs.forEach((kgEdgeID) => {
            edge_bindings.push({
              id: kgEdgeID
            });
          });
        });

        return result;
      });
  }
};
