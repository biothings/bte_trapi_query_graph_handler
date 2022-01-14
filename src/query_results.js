const { cloneDeep, keys, spread, toPairs, values, zip } = require('lodash');
const GraphHelper = require('./helper');
const helper = new GraphHelper();
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

// TODO: if these are correct, they should probably be moved to helper.js
function _getInputIsSet(record) {
  return record.$edge_metadata.trapi_qEdge_obj.reverse
    ? record.$edge_metadata.trapi_qEdge_obj.object.is_set
    : record.$edge_metadata.trapi_qEdge_obj.subject.is_set;
}
function _getOutputIsSet(record) {
  return record.$edge_metadata.trapi_qEdge_obj.reverse
    ? record.$edge_metadata.trapi_qEdge_obj.subject.is_set
    : record.$edge_metadata.trapi_qEdge_obj.object.is_set;
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

  /**
   * Create combinations of record data where each combination satisfies the query graph,
   * with each hop having one associated record and every associated record being linked
   * to its neighbor as per the query graph.
   *
   * These combinations are called preresults, because they hold the data used to
   * assemble the actual results.
   *
   * This is a recursive function, and it traverses the query graph as a tree, with
   * every recursion passing its output queryNodeID and primaryID to the next call
   * to use as a matching criteria for its input.
   *
   * This graphic helps to explain how this works:
   * https://github.com/biothings/BioThings_Explorer_TRAPI/issues/341#issuecomment-972140186
   *
   * The preresults returned from this method are not at all consolidated. They are
   * analogous to the collection of sets in the lower left of the graphic, which
   * represents every valid combination of primaryIDs and kgEdgeIDs but excludes
   * invalid combinations like B-1-Z, which is a dead-end.
   *
   * NOTE: this currently only works for trees (no cycles). If we want to handle cycles,
   * we'll probably need to keep track of what's been visited.
   * But A.S. said we don't have to worry about cycles for now.
   *
   * @return {
   *   inputQueryNodeID: string,
   *   outputQueryNodeID: string,
   *   inputPrimaryID: string,
   *   outputPrimaryID: string,
   *   queryEdgeID: string,
   *   kgEdgeID: string,
   * }
   */
  _getPreresults(
    dataByEdge,
    queryEdgeID,
    edgeCount,
    preresults,
    preresult,
    queryNodeIDToMatch,
    primaryIDToMatch
  ) {
    //connected_to and records of starting edge of tree
    const {connected_to, records} = dataByEdge[queryEdgeID];

    //get a valid record from records to continue
    let record = records.find(rec => rec !== undefined);

    // queryNodeID example: 'n0'
    const inputQueryNodeID = helper._getInputQueryNodeID(record);
    const outputQueryNodeID = helper._getOutputQueryNodeID(record);

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

    const preresultClone = [...preresult];

    records.filter((record) => {
      return [getMatchingPrimaryID(record), undefined].indexOf(primaryIDToMatch) > -1 ;
    }).forEach((record, i) => {
      // primaryID example: 'NCBIGene:1234'
      const matchingPrimaryID = getMatchingPrimaryID(record); //not used?
      const otherPrimaryID = getOtherPrimaryID(record);

      if (i !== 0) {
        preresult = [...preresultClone];
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

      connected_to.forEach((connectedQueryEdgeID) => {
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
   * For the purposes of consolidating results, a unique node ID just
   * depends on whether 'is_set' is true or false.
   *
   * If it's true, then we only care about the QNode ID
   * (inputQueryNodeID or outputQueryNodeID), e.g., n1.
   *
   * If it's false, then we need to take into account the primaryID
   * (inputPrimaryID or outputPrimaryID) as well, e.g., n0-NCBIGene:3630.
   *
   * We will later use these uniqueNodeIDs to generate unique result IDs.
   * The unique result IDs will be unique per result, but they will only
   * contain the bare minimum of information required to make them unique.
   *
   * Examples of what these unique results IDs can look like
   *   when is_set is specified for n1:
   *     "n0-NCBIGene:3630-n1_&_n1-n2-PUBCHEM.COMPOUND:43815"
   *
   *   when is_set is NOT specified for n1:
   *     "n0-NCBIGene:3630-n1-MONDO:0005068_&_n1-MONDO:0005068-n2-PUBCHEM.COMPOUND:43815"
   *     "n0-NCBIGene:3630-n1-MONDO:0005010_&_n1-MONDO:0005010-n2-PUBCHEM.COMPOUND:43815"
   *
   * @param {Set<string>} queryNodeIDsWithIsSet
   * @param {string} queryNodeID
   * @param {string} primaryID
   * @return {string} uniqueNodeID
   */
  _getUniqueNodeID(queryNodeIDsWithIsSet, queryNodeID, primaryID) {
    if (queryNodeIDsWithIsSet.has(queryNodeID)) {
      return queryNodeID;
    } else {
      return `${queryNodeID}-${primaryID}`;
    }
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

    const edges = new Set(keys(dataByEdge));
    const edgeCount = edges.size;

    // find all QNodes having is_set params
    // NOTE: is_set in the query graph and the JavaScript Set object below refer to different sets.
    const queryNodeIDsWithIsSet = new Set();
    toPairs(dataByEdge).forEach(([queryEdgeID, {connected_to, records}]) => {
      const inputQueryNodeID = helper._getInputQueryNodeID(records[0]);
      const outputQueryNodeID = helper._getOutputQueryNodeID(records[0]);

      if (_getInputIsSet(records[0])) {
        queryNodeIDsWithIsSet.add(inputQueryNodeID)
      } else if (_getOutputIsSet(records[0])) {
        queryNodeIDsWithIsSet.add(outputQueryNodeID)
      }
    });

    // find a QNode having only one QEdge to use as the root node for tree traversal
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

    /**
     * Consolidation
     *
     * With reference to this graphic:
     * https://github.com/biothings/BioThings_Explorer_TRAPI/issues/341#issuecomment-972140186
     * The preresults are analogous to the collection of sets in the lower left. Now we want
     * to consolidate the preresults as indicated by the the large blue arrow in the graphic
     * to get consolidatedPreresults, which are almost identical the the final results, except
     * for some minor differences that make it easier to perform the consolidation.
     *
     * There are two cases where we need to consolidate preresults:
     * 1. one or more query nodes have an 'is_set' param
     * 2. one or more primaryID pairs have multiple kgEdges each
     *
     * We perform consolidation by first grouping preresults by uniqueResultID and
     * then merging each of those groups into a single consolidatedPreresult.
     */

    const preresultsByUniqueResultID = {};

    preresults.forEach((preresult) => {
      // example inputPrimaryID and outputPrimaryID in a preresult:
      // [
      //   {"inputPrimaryID": "NCBIGene:3630", "outputPrimaryID", "MONDO:0005068"},
      //   {"inputPrimaryID": "MONDO:0005068", "outputPrimaryID", "PUBCHEM.COMPOUND:43815"}
      // ]
      //
      // Other items present in a presult but not shown above:
      // inputQueryNodeID, outputQueryNodeID, queryEdgeID, kgEdgeID

      const uniqueNodeIDs = [];

      const firstRecord = preresult[0];
      // Add the input for the first record and then just add outputs after that.
      // The output for one record is the input for the subsequent record. 
      uniqueNodeIDs.push(
        this._getUniqueNodeID(queryNodeIDsWithIsSet, firstRecord.inputQueryNodeID, firstRecord.inputPrimaryID)
      );

      preresult.forEach(({
        inputQueryNodeID, outputQueryNodeID,
        inputPrimaryID, outputPrimaryID,
        queryEdgeID, kgEdgeID
      }) => {
        uniqueNodeIDs.push(
          this._getUniqueNodeID(queryNodeIDsWithIsSet, outputQueryNodeID, outputPrimaryID)
        );
      });

      const uniqueResultID = uniqueNodeIDs.join("_&_");
      // Example uniqueResultIDs:
      //   when is_set specified for n1:
      //     "n0-NCBIGene:3630-n1_&_n1-n2-PUBCHEM.COMPOUND:43815"
      //
      //   when is_set NOT specified for n1:
      //     "n0-NCBIGene:3630-n1-MONDO:0005068_&_n1-MONDO:0005068-n2-PUBCHEM.COMPOUND:43815"
      //     "n0-NCBIGene:3630-n1-MONDO:0005010_&_n1-MONDO:0005010-n2-PUBCHEM.COMPOUND:43815"

      if (!preresultsByUniqueResultID.hasOwnProperty(uniqueResultID)) {
        preresultsByUniqueResultID[uniqueResultID] = [];
      }
      preresultsByUniqueResultID[uniqueResultID].push(preresult)
    });

    const consolidatedPreresults = values(preresultsByUniqueResultID).map(preresults => {
      // spread is like Fn.apply
      return spread(zip)(preresults).map(preresultRecords => {
        const firstPreresultRecord = preresultRecords[0];
        const consolidatedPreresultRecord = {
          inputQueryNodeID: firstPreresultRecord.inputQueryNodeID,
          outputQueryNodeID: firstPreresultRecord.outputQueryNodeID,
          inputPrimaryIDs: new Set(),
          outputPrimaryIDs: new Set(),
          queryEdgeID: firstPreresultRecord.queryEdgeID,
          kgEdgeIDs: new Set()
        };
        preresultRecords.forEach(({
          inputQueryNodeID, outputQueryNodeID,
          inputPrimaryID, outputPrimaryID,
          queryEdgeID, kgEdgeID
        }) => {
          consolidatedPreresultRecord.inputPrimaryIDs.add(inputPrimaryID);
          consolidatedPreresultRecord.outputPrimaryIDs.add(outputPrimaryID);
          consolidatedPreresultRecord.kgEdgeIDs.add(kgEdgeID);
        });
        return consolidatedPreresultRecord;
      });
    });

    /**
     * The last step is to do the minor re-formatting to turn consolidatedPreresults
     * into the desired final results.
     */
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

        result.edge_bindings[queryEdgeID] = Array.from(kgEdgeIDs).map((kgEdgeID) => {
          return {
            id: kgEdgeID
          };
        });
      });

      return result;
    });
  }
};
