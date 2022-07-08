const { cloneDeep, keys, spread, toPairs, values, zip } = require('lodash');
const debug = require('debug')('bte:biothings-explorer-trapi:QueryResult');
const LogEntry = require('../log_entry');
const { getScores, calculateScore } = require('./score');
const { Record } = require('@biothings-explorer/api-response-transform');
const { getPfocr } = require('./pfocr');


/**
 * @type { Record }
 *
 * @typedef {
 *   connected_to: string[],
 *   records: Record[]
 * } EdgeData
 *
 * @typedef {string} QueryEdgeID
 *
 * @typedef {Object.<string, EdgeData>} RecordsByQEdgeID
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
 */
module.exports = class TrapiResultsAssembler {
  /**
   * Create a QueryResult i9nstance.
   */
  constructor() {
    /**
     * @property {Result[]} _results - list of query results
     * @private
     */
    this._results = [];
    this.logs = [];
  }

  getResults() {
    return this._results;
  }

  /**
   * Find all QNodes having only one QEdge, sorted by least records first
   * @return {string[][]}
   */
  _getValidInitialPairs(recordsByQEdgeID) {
    // qNodeID: set{qEdgeID} for node: edges using node
    const qNodeEdgeCounts = toPairs(recordsByQEdgeID).reduce(
      (qNodeCounts, [queryEdgeID, { connected_to, records }]) => {
        [
          records[0].subject.qNodeID,
          records[0].object.qNodeID,
        ].forEach((qNodeID) => {
          if (!qNodeCounts[qNodeID]) {
            qNodeCounts[qNodeID] = new Set();
          }
          qNodeCounts[qNodeID].add(queryEdgeID);
        });
        return qNodeCounts;
      },
      {},
    );
    // qNodeID: qEdgeID for valid 'leaf' nodes, sorted by # records ascending
    const validNodes = toPairs(qNodeEdgeCounts)
      .filter(([qNodeID, qEdgeIDs]) => qEdgeIDs.size < 2)
      .map(([qNodeID, qEdgeIDs]) => [qNodeID, [...qEdgeIDs][0]])
      .sort(([qNodeID_0, qEdgeID_0], [qNodeID_1, qEdgeID_1]) => {
        return recordsByQEdgeID[qEdgeID_0].records.length - recordsByQEdgeID[qEdgeID_1].records.length;
      });

    return validNodes;
  }

  /**
   * Create combinations of record data where each combination satisfies the query graph,
   * with each hop having one associated record and every associated record being linked
   * to its neighbor as per the query graph.
   *
   * These combinations are called queryGraphSolutions, because they hold the data used to
   * assemble the actual results.
   *
   * This is a recursive function, and it traverses the query graph as a tree, with
   * every recursion passing its output queryNodeID and primaryCurie to the next call
   * to use as a matching criteria for its input.
   *
   * This graphic helps to explain how this works:
   * https://github.com/biothings/BioThings_Explorer_TRAPI/issues/341#issuecomment-972140186
   *
   * The queryGraphSolutions returned from this method are not at all consolidated. They are
   * analogous to the collection of sets in the lower left of the graphic, which
   * represents every valid combination of primaryCuries and recordHashes but excludes
   * invalid combinations like B-1-Z, which is a dead-end.
   *
   * NOTE: this currently only works for trees (no cycles). If we want to handle cycles,
   * we'll probably need to keep track of what's been visited.
   * But A.S. said we don't have to worry about cycles for now.
   *
   * @return {
   *   inputQNodeID: string,
   *   outputQNodeID: string,
   *   inputPrimaryCurie: string,
   *   outputPrimaryCurie: string,
   *   qEdgeID: string,
   *   recordHash: string,
   * }
   */
  _getQueryGraphSolutions(
    recordsByQEdgeID,
    qEdgeID,
    edgeCount,
    queryGraphSolutions,
    queryGraphSolution,
    qNodeIDToMatch,
    primaryCurieToMatch
  ) {
    //connected_to and records of starting edge of tree
    const {connected_to, records} = recordsByQEdgeID[qEdgeID];

    //get a valid record from records to continue
    let record = records.find(rec => rec !== undefined);

    // queryNodeID example: 'n0'
    const inputQNodeID = record.subject.qNodeID;
    const outputQNodeID = record.object.qNodeID;

    let otherQNodeID, getMatchingPrimaryCurie, getOtherPrimaryCurie;

    if ([inputQNodeID, undefined].indexOf(qNodeIDToMatch) > -1) {
      qNodeIDToMatch = inputQNodeID;
      otherQNodeID = outputQNodeID;
      getMatchingPrimaryCurie = (record) => record.subject.curie;
      getOtherPrimaryCurie = (record) => record.object.curie;
    } else if (qNodeIDToMatch === outputQNodeID) {
      otherQNodeID = inputQNodeID;
      getMatchingPrimaryCurie = (record) => record.object.curie;
      getOtherPrimaryCurie = (record) => record.subject.curie;
    } else {
      return;
    }

    const solutionClone = [...queryGraphSolution];

    records.filter((record) => {
      return [getMatchingPrimaryCurie(record), undefined].indexOf(primaryCurieToMatch) > -1 ;
    }).forEach((record, i) => {
      // primaryCurie example: 'NCBIGene:1234'
      const matchingPrimaryCurie = getMatchingPrimaryCurie(record); //not used?
      const otherPrimaryCurie = getOtherPrimaryCurie(record);

      if (i !== 0) {
        queryGraphSolution = [...solutionClone];
      }

      queryGraphSolution.push({
        inputQNodeID: record.subject.qNodeID,
        outputQNodeID: record.object.qNodeID,
        inputPrimaryCurie: record.subject.curie,
        outputPrimaryCurie: record.object.curie,
        inputUMLS: record.subject.UMLS, //add umls for scoring
        outputUMLS: record.object.UMLS, //add umls for scoring
        qEdgeID: qEdgeID,
        recordHash: record.recordHash,
      });

      if (queryGraphSolution.length == edgeCount) {
        queryGraphSolutions.push(queryGraphSolution);
      }

      connected_to.forEach((connectedQEdgeID) => {
        this._getQueryGraphSolutions(
          recordsByQEdgeID,
          connectedQEdgeID,
          edgeCount,
          queryGraphSolutions,
          queryGraphSolution,
          otherQNodeID,
          otherPrimaryCurie
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
   * If it's false, then we additionally need to take into account the primaryCurie
   * (inputPrimaryCurie or outputPrimaryCurie), e.g., n0-NCBIGene:3630.
   *
   * We will later use these uniqueNodeIDs to generate unique result IDs.
   * The unique result IDs will be unique per result and be made up of only
   * the minimum information required to make them unique.
   *
   * @param {Set<string>} qNodeIDsWithIsSet
   * @param {string} qNodeID
   * @param {string} primaryCurie
   * @return {string} uniqueNodeID
   */
  _getUniqueNodeID(qNodeIDsWithIsSet, qNodeID, primaryCurie) {
    if (qNodeIDsWithIsSet.has(qNodeID)) {
      return qNodeID;
    } else {
      return `${qNodeID}-${primaryCurie}`;
    }
  }

  /**
   * Assemble records into query results.
   *
   * At a high level, this method does the following:
   * 1. Create sets of records such that:
   *    - each set has one record per QEdge and
   *    - each record in a set has the same primaryCurie as its neighbor(s) at the same QNode.
   *    We're calling each set a queryGraphSolution.
   * 2. Group the sets by result ID. There will be one group per query result.
   * 3. Consolidate each group. We're calling each consolidated group a consolidatedSolutions.
   *    Each consolidatedSolution becomes a query result.
   * 4. Format consolidatedSolutions to match the translator standard for query results
   *    and cache the query results to be called later by .getResults().
   *
   * Note: with the updated code for generalized query handling, we
   * can safely assume every call to update contains all the records.
   *
   * @param {RecordsByQEdgeID} recordsByQEdgeID
   * @return {undefined} nothing returned; just cache this._results
   */
  async update(recordsByQEdgeID) {
    debug(`Updating query results now!`);

    let scoreCombos = [];
    try {
      scoreCombos = await getScores(recordsByQEdgeID);
      debug(`Successfully got ${scoreCombos.length} score combos.`);
    } catch (err) {
      debug("Error getting scores: ", err);
    }

    this._results = [];

    const qEdgeIDs = new Set(keys(recordsByQEdgeID));
    const qEdgeCount = qEdgeIDs.size;

    // find all QNodes having is_set params
    // NOTE: is_set in the query graph and the JavaScript Set object below refer to different sets.
    const qNodeIDsWithIsSet = new Set();
    toPairs(recordsByQEdgeID).forEach(([qEdgeID, {connected_to, records}]) => {

      const inputQNodeID = records[0].subject.qNodeID;
      const outputQNodeID = records[0].object.qNodeID;

      if (records[0].subject.isSet) {
        qNodeIDsWithIsSet.add(inputQNodeID)
      }
      if (records[0].object.isSet) {
        qNodeIDsWithIsSet.add(outputQNodeID)
      }
    });

    debug(`Nodes with "is_set": ${JSON.stringify([...qNodeIDsWithIsSet])}`)

    // find a QNode having only one QEdge to use as the root node for tree traversal
    let [initialQNodeIDToMatch, initialQEdgeID] = this._getValidInitialPairs(recordsByQEdgeID)[0];

    debug(`initialQEdgeID: ${initialQEdgeID}, initialQNodeIDToMatch: ${initialQNodeIDToMatch}`);

    const queryGraphSolutions = [];
    this._getQueryGraphSolutions(
      recordsByQEdgeID,
      initialQEdgeID,
      qEdgeCount,
      queryGraphSolutions,
      [], // first queryGraphSolution
      initialQNodeIDToMatch,
    );

    /**
     * Consolidation
     *
     * With reference to this graphic:
     * https://github.com/biothings/BioThings_Explorer_TRAPI/issues/341#issuecomment-972140186
     * The queryGraphSolutions are analogous to the collection of sets in the lower left. Now we want
     * to consolidate the queryGraphSolutions as indicated by the the large blue arrow in the graphic
     * to get consolidatedSolutions, which are almost identical the the final results, except
     * for some minor differences that make it easier to perform the consolidation.
     *
     * There are two cases where we need to consolidate queryGraphSolutions:
     * 1. one or more query nodes have an 'is_set' param
     * 2. one or more primaryCurie pairs have multiple kgEdges each
     *
     * We perform consolidation by first grouping queryGraphSolutions by trapiResultID and
     * then merging each of those groups into a single consolidatedSolution.
     */

    const solutionsByTrapiResultID = {};
    queryGraphSolutions.forEach((queryGraphSolution) => {
      // example inputPrimaryCurie and outputPrimaryCurie in a queryGraphSolution:
      // [
      //   {"inputPrimaryCurie": "NCBIGene:3630", "outputPrimaryCurie", "MONDO:0005068"},
      //   {"inputPrimaryCurie": "MONDO:0005068", "outputPrimaryCurie", "PUBCHEM.COMPOUND:43815"}
      // ]
      //
      // Other items present in a queryGraphSolution but not shown above:
      // inputQNodeID, outputQNodeID, queryEdgeID, recordHash

      // using a set so we don't repeat a previously entered input as an output or vice versa.
      const uniqueNodeIDs = new Set();

      queryGraphSolution.forEach(({
        inputQNodeID, outputQNodeID,
        inputPrimaryCurie, outputPrimaryCurie,
        qEdgeID, recordHash
      }) => {
        uniqueNodeIDs.add(
          this._getUniqueNodeID(qNodeIDsWithIsSet, inputQNodeID, inputPrimaryCurie)
        );
        uniqueNodeIDs.add(
          this._getUniqueNodeID(qNodeIDsWithIsSet, outputQNodeID, outputPrimaryCurie)
        );
      });

      // The separator can be anything that won't appear in the actual QNodeIDs or primaryCuries
      // Using .sort() because a JS Set is iterated in insertion order, and I haven't
      // verified the queryGraphSolutions are always in the same order. However, they should be,
      // so it's possible .sort() is not needed.
      const trapiResultID = Array.from(uniqueNodeIDs).sort().join("_&_");
      // input_QNodeID-input_primaryCurie_&_output_QNodeID-_output_primaryCurie_&_...
      //
      // Example trapiResultIDs:
      //   when is_set specified for n1:
      //     "n0-NCBIGene:3630_&_n1_&_n2-PUBCHEM.COMPOUND:43815"
      //
      //   when is_set NOT specified for n1:
      //     "n0-NCBIGene:3630_&_n1-MONDO:0005068_&_n2-PUBCHEM.COMPOUND:43815"
      //     "n0-NCBIGene:3630_&_n1-MONDO:0005010_&_n2-PUBCHEM.COMPOUND:43815"

      if (!solutionsByTrapiResultID.hasOwnProperty(trapiResultID)) {
        solutionsByTrapiResultID[trapiResultID] = [];
      }
      solutionsByTrapiResultID[trapiResultID].push(queryGraphSolution)
    });

    const consolidatedSolutions = toPairs(solutionsByTrapiResultID).map(([trapiResultID, queryGraphSolutions]) => {
      debug(`result ID: ${trapiResultID} has ${queryGraphSolutions.length}`)
      // spread is like Fn.apply
      // TODO: maybe just use ...
      return spread(zip)(queryGraphSolutions).map(solutionRecords => {
        const solutionRecord_0 = solutionRecords[0];
        const consolidatedSolutionRecord = {
          inputQNodeID: solutionRecord_0.inputQNodeID,
          outputQNodeID: solutionRecord_0.outputQNodeID,
          inputUMLS: solutionRecord_0.inputUMLS,
          outputUMLS: solutionRecord_0.outputUMLS,
          inputPrimaryCuries: new Set(),
          outputPrimaryCuries: new Set(),
          qEdgeID: solutionRecord_0.qEdgeID,
          recordHashes: new Set()
        };
        solutionRecords.forEach(({
          inputQNodeID, outputQNodeID,
          inputPrimaryCurie, outputPrimaryCurie,
          qEdgeID, recordHash
        }) => {
          //debug(`  inputQNodeID: ${inputQNodeID}, inputPrimaryCurie: ${inputPrimaryCurie}, outputQNodeID ${outputQNodeID}, outputPrimaryCurie: ${outputPrimaryCurie}`)
          consolidatedSolutionRecord.inputPrimaryCuries.add(inputPrimaryCurie);
          consolidatedSolutionRecord.outputPrimaryCuries.add(outputPrimaryCurie);
          consolidatedSolutionRecord.recordHashes.add(recordHash);
        });
        return consolidatedSolutionRecord;
      });
    });

    let resultsWithoutScore = 0;
    let resultsWithScore = 0;
    /**
     * The last step is to do the minor re-formatting to turn consolidatedSolutions
     * into the desired final results.
     */
    this._results = consolidatedSolutions.map((consolidatedSolution) => {

      // TODO: replace with better score implementation later
      const result = {node_bindings: {}, edge_bindings: {}, score: calculateScore(consolidatedSolution, scoreCombos)};
      if (result.score == 0) {
        resultsWithoutScore++;
      } else {
        resultsWithScore++;
      }

      consolidatedSolution.forEach(({
        inputQNodeID, outputQNodeID,
        inputPrimaryCuries, outputPrimaryCuries,
        qEdgeID, recordHashes
      }) => {
        result.node_bindings[inputQNodeID] = Array.from(inputPrimaryCuries).map(inputPrimaryCurie => {
          return {
            id: inputPrimaryCurie
          };
        });

        result.node_bindings[outputQNodeID] = Array.from(outputPrimaryCuries).map(outputPrimaryCurie => {
          return {
            id: outputPrimaryCurie
          };
        });

        result.edge_bindings[qEdgeID] = Array.from(recordHashes).map((recordHash) => {
          return {
            id: recordHash
          };
        });
      });

      return result;
    })
    .sort((result1, result2) => (result2.score - result1.score)); //sort by decreasing score

    debug(`Successfully scored ${resultsWithScore} results, couldn't score ${resultsWithoutScore} results.`);
    this.logs.push(
      new LogEntry('DEBUG', null, `Successfully scored ${resultsWithScore} results, couldn't score ${resultsWithoutScore} results.`).getLog(),
    );
  }
};
