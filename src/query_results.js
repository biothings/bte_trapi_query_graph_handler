const { cloneDeep, keys, toPairs, values } = require('lodash');
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
  return record.$edge_metadata.trapi_qEdge_obj.isReversed()
    ? record.$edge_metadata.trapi_qEdge_obj.object.isSet()
    : record.$edge_metadata.trapi_qEdge_obj.subject.isSet();
}
function _getOutputIsSet(record) {
  return record.$edge_metadata.trapi_qEdge_obj.isReversed()
    ? record.$edge_metadata.trapi_qEdge_obj.subject.isSet()
    : record.$edge_metadata.trapi_qEdge_obj.object.isSet();
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

    // find all QNodes having isSet() params
    // NOTE: isSet() in the query graph and the JavaScript Set object below refer to different sets.
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
     * There are two types of consolidation we need to perform here:
     * 1. one or more query nodes have an 'isSet()' param
     * 2. one or more primaryID pairs have multiple kgEdges each
     */
    const consolidatedPreresults = [];

    /**
     * for when there's an isSet() param
     *
     * primaryIDsByQueryNodeID could look like this:
     * {
     *   "n0": new Set(["NCBIGene:3630"]),
     *   "n1": new Set(["MONDO:0005068", "MONDO:0005010"])
     * }
     */
    let primaryIDsByQueryNodeID = {};
    const kgEdgeIDsByQueryEdgeID = {};

    // for when there's NOT an isSet() param.
    // It's currently just consolidating when there are multiple KG edge predicates.
    let kgEdgeIDsByRecordDedupTag = {};

    // Each of these tags is an identifier for a result and is made up of the concatenation
    // of every recordDedupTag for a given preresult.
    //
    // These tags contain the info we use to determine whether a result is a duplicate
    // (one or more records for a result should be consolidated).
    //
    // This info will vary depending on things like whether the QEdge has any isSet() params.
    const resultDedupTags = new Set();

    preresults.forEach((preresult) => {
      let consolidatedPreresult = [];

      // a preresultRecord is basically the information from a record,
      // but formatted differently for purposes of assembling results.
      let preresultRecord = {
        inputPrimaryIDs: new Set(),
        outputPrimaryIDs: new Set(),
        kgEdgeIDs: new Set(),
      };

      const preresultRecordClone = {...preresultRecord};

      // This is needed because consolidation when isSet() is NOT specified
      // is more limited than when it is specified. It's currently just
      // consolidating when there are multiple KG edge predicates.
      //
      // TODO: it's a little confusing why we need the preresult.length check, but
      // without it, the following test in QueryResult.test.js fails:
      // 'should get 1 result with 2 edge mappings when predicates differ: ⇉'
      if (preresult.length > 1) {
        kgEdgeIDsByRecordDedupTag = {};
      }

      let recordDedupTags = [];

      preresult.forEach(({
        inputQueryNodeID, outputQueryNodeID,
        inputPrimaryID, outputPrimaryID,
        queryEdgeID, kgEdgeID
      }, j) => {

        if (queryNodeIDsWithIsSet.has(inputQueryNodeID) && queryNodeIDsWithIsSet.has(outputQueryNodeID)) {
          // both QNodes of the QEdge for this record have isSet() params 

          const recordDedupTag = [inputQueryNodeID, outputQueryNodeID].join("-")
          recordDedupTags.push(recordDedupTag);

          // TODO: why do we always do this here, but in the 'else' section below, we
          // only do it when kgEdgeIDsByRecordDedupTag[recordDedupTag] doesn't exist?
          // The tests pass regardless of whether this is inside or outside of the
          // if statement below.
          preresultRecord = cloneDeep(preresultRecordClone);
          consolidatedPreresult.push(preresultRecord);

          if (!(primaryIDsByQueryNodeID.hasOwnProperty(inputQueryNodeID) && primaryIDsByQueryNodeID.hasOwnProperty(outputQueryNodeID))) {
            kgEdgeIDsByQueryEdgeID[queryEdgeID] = new Set();
            preresultRecord.kgEdgeIDs = kgEdgeIDsByQueryEdgeID[queryEdgeID];

            if (!primaryIDsByQueryNodeID.hasOwnProperty(inputQueryNodeID)) {
              primaryIDsByQueryNodeID[inputQueryNodeID] = new Set();
              preresultRecord.inputPrimaryIDs = primaryIDsByQueryNodeID[inputQueryNodeID];
            }

            if (!primaryIDsByQueryNodeID.hasOwnProperty(outputQueryNodeID)) {
              primaryIDsByQueryNodeID[outputQueryNodeID] = new Set();
              preresultRecord.outputPrimaryIDs = primaryIDsByQueryNodeID[outputQueryNodeID];
            }
          }

          primaryIDsByQueryNodeID[inputQueryNodeID].add(inputPrimaryID);
          primaryIDsByQueryNodeID[outputQueryNodeID].add(outputPrimaryID);
          kgEdgeIDsByQueryEdgeID[queryEdgeID].add(kgEdgeID);
        } else if (queryNodeIDsWithIsSet.has(inputQueryNodeID)) {
          // The input QNode of the QEdge for this record has an isSet() param.

          const recordDedupTag = [inputQueryNodeID, outputQueryNodeID, outputPrimaryID].join("-")
          recordDedupTags.push(recordDedupTag);

          // TODO: why must we always do this here, but in the 'else' section below, we
          // only do it when kgEdgeIDsByRecordDedupTag[recordDedupTag] doesn't exist?
          // Some tests fail when this is inside the if statement below
          preresultRecord = cloneDeep(preresultRecordClone);
          consolidatedPreresult.push(preresultRecord);

          if (!kgEdgeIDsByQueryEdgeID.hasOwnProperty(queryEdgeID)) {
            kgEdgeIDsByQueryEdgeID[queryEdgeID] = new Set();
            preresultRecord.kgEdgeIDs = kgEdgeIDsByQueryEdgeID[queryEdgeID];
          }
          kgEdgeIDsByQueryEdgeID[queryEdgeID].add(kgEdgeID);

          preresultRecord.kgEdgeIDs = kgEdgeIDsByQueryEdgeID[queryEdgeID];
          preresultRecord.inputPrimaryIDs = primaryIDsByQueryNodeID[inputQueryNodeID];

          kgEdgeIDsByQueryEdgeID[queryEdgeID].add(kgEdgeID);
          primaryIDsByQueryNodeID[inputQueryNodeID].add(inputPrimaryID);
        } else if (queryNodeIDsWithIsSet.has(outputQueryNodeID)) {
          // TODO: verify I switched input & output correctly below in this block:
          
          // The output QNode of the QEdge for this record has an isSet() param.

          const recordDedupTag = [outputQueryNodeID, inputQueryNodeID, inputPrimaryID].join("-")
          recordDedupTags.push(recordDedupTag);

          // TODO: why must we always do this here, but in the 'else' section below, we
          // only do it when kgEdgeIDsByRecordDedupTag[recordDedupTag] doesn't exist?
          // Some tests fail when this is inside the if statement below
          preresultRecord = cloneDeep(preresultRecordClone);
          consolidatedPreresult.push(preresultRecord);

          if (!kgEdgeIDsByQueryEdgeID.hasOwnProperty(queryEdgeID)) {
            kgEdgeIDsByQueryEdgeID[queryEdgeID] = new Set();
            preresultRecord.kgEdgeIDs = kgEdgeIDsByQueryEdgeID[queryEdgeID];
          }
          kgEdgeIDsByQueryEdgeID[queryEdgeID].add(kgEdgeID);

          preresultRecord.kgEdgeIDs = kgEdgeIDsByQueryEdgeID[queryEdgeID];
          preresultRecord.inputPrimaryIDs = primaryIDsByQueryNodeID[outputQueryNodeID];

          kgEdgeIDsByQueryEdgeID[queryEdgeID].add(kgEdgeID);
          primaryIDsByQueryNodeID[outputQueryNodeID].add(outputPrimaryID);
        } else {
          // The only other consolidation we need to do is when two primaryIDs for two
          // different respective QNodes have multiple KG Edges connecting them.
          const recordDedupTag = [
            inputQueryNodeID,
            inputPrimaryID,
            outputQueryNodeID,
            outputPrimaryID
          ].join("-");

          recordDedupTags.push(recordDedupTag);

          if (!kgEdgeIDsByRecordDedupTag.hasOwnProperty(recordDedupTag)) {
            preresultRecord = cloneDeep(preresultRecordClone);
            consolidatedPreresult.push(preresultRecord);

            kgEdgeIDsByRecordDedupTag[recordDedupTag] = new Set();
            preresultRecord.kgEdgeIDs = kgEdgeIDsByRecordDedupTag[recordDedupTag];

            // When isSet() is not specified, each preresultRecord only has one
            // each of unique inputPrimaryID and outputPrimaryID.
            preresultRecord.inputPrimaryIDs.add(inputPrimaryID);
            preresultRecord.outputPrimaryIDs.add(outputPrimaryID);
          }

          kgEdgeIDsByRecordDedupTag[recordDedupTag].add(kgEdgeID);
        }

        preresultRecord.inputQueryNodeID = inputQueryNodeID;
        preresultRecord.outputQueryNodeID = outputQueryNodeID;
        preresultRecord.queryEdgeID = queryEdgeID;
      });

      const resultDedupTag = recordDedupTags.join("-");
      if (consolidatedPreresult.length === edgeCount && (!resultDedupTags.has(resultDedupTag))) {
        consolidatedPreresults.push(consolidatedPreresult);
        resultDedupTags.add(resultDedupTag)
      }
    });

    /**
     * The last step is to do the minor re-formatting to turn consolidatedResults
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
