const _ = require('lodash');
const LogEntry = require('./log_entry');
const BTEError = require('./exceptions/bte_error');
const debug = require('debug')('bte:biothings-explorer-trapi:edge-manager');
const config = require('./config');
const BatchEdgeQueryHandler = require('./batch_edge_query');


module.exports = class QueryEdgeManager {
  constructor(edges, metaKG, options) {
    // flatten list of all edges available
    this._qEdges = _.flatten(edges);
    this._metaKG = metaKG;
    this.logs = [];
    this._records = [];
    //organized by edge with refs to connected edges
    this._organizedRecords = {};
    this.options = options;
    this.init();
  }

  getRecords() {
    debug(`(13) Edge Manager reporting combined records...`);
    return this._records;
  }

  getOrganizedRecords() {
    debug(`(13) Edge Manager reporting organized records...`);
    return this._organizedRecords;
  }

  init() {
    debug(`(3) Edge manager is managing ${this._qEdges.length} qEdges.`);
    this.logs.push(new LogEntry('DEBUG', null, `Edge manager is managing ${this._qEdges.length} qEdges.`).getLog());
  }

  getNext() {
    //returns next edge with lowest entity count on
    //either object or subject OR no count last
    // available not yet executed
    let available_edges = this._qEdges.filter((qEdge) => !qEdge.executed);
    //safeguard for making sure there's available
    //edges when calling getNext
    if (available_edges.length == 0) {
      debug(`(5) Error: ${available_edges} available qEdges found.`);
      this.logs.push(
        new LogEntry(
          'DEBUG',
          null,
          `Edge manager cannot get next qEdge, ` + `(${available_edges}) available edges found.`,
        ).getLog(),
      );
    }
    //begin search
    let nextQEdge;
    let lowest_entity_count;
    let current_obj_lowest = 0;
    let current_sub_lowest = 0;
    available_edges.forEach((qEdge) => {
      if (qEdge && qEdge.object.entity_count) {
        current_obj_lowest = qEdge.object.entity_count;
        if (!lowest_entity_count) {
          //set current lowest if none
          lowest_entity_count = current_obj_lowest;
        }
        if (current_obj_lowest <= lowest_entity_count) {
          //lowest is now object count
          nextQEdge = qEdge;
        }
      }
      if (qEdge && qEdge.subject.entity_count && qEdge.subject.entity_count > 0) {
        current_sub_lowest = qEdge.subject.entity_count;
        if (!lowest_entity_count) {
          //set current lowest if none
          lowest_entity_count = current_sub_lowest;
        }
        if (current_sub_lowest <= lowest_entity_count) {
          //lowest is now subject count
          nextQEdge = qEdge;
        }
      }
    });
    if (!nextQEdge) {
      //if no edge with count found pick the first empty
      //edge available
      let all_empty = available_edges.filter((edge) => !edge.object.entity_count && !edge.subject.entity_count);
      if (all_empty.length == 0) {
        debug(`(5) Error: No available qEdges found.`);
        this.logs.push(new LogEntry('DEBUG', null, `Cannot get next edge, No available qEdges found.`).getLog());
      }
      debug(`(5) Sending next edge '${all_empty[0].getID()}' with NO entity count.`);
      return this.preSendOffCheck(all_empty[0]);
    }
    debug(
      `(5) Sending next edge '${nextQEdge.getID()}' ` +
        `WITH entity count...(${nextQEdge.subject.entity_count || nextQEdge.object.entity_count})`,
    );
    return this.preSendOffCheck(nextQEdge);
  }

  logEntityCounts() {
    this._qEdges.forEach((qEdge) => {
      debug(
        `'${qEdge.getID()}'` +
          ` : (${qEdge.subject.entity_count || 0}) ` +
          `${qEdge.reverse ? '<--' : '-->'}` +
          ` (${qEdge.object.entity_count || 0})`,
      );
    });
  }

  _logSkippedQueries(unavailableAPIs) {
    Object.entries(unavailableAPIs).forEach(([api, { skippedQueries }]) => {
      if (skippedQueries > 0) {
        const skipMessage = `${skippedQueries} additional quer${skippedQueries > 1 ? 'ies' : 'y'} to ${api} ${
          skippedQueries > 1 ? 'were' : 'was'
        } skipped as the API was unavailable.`;
        debug(skipMessage);
        this.logs.push(new LogEntry('WARNING', null, skipMessage).getLog());
      }
    });
  }

  checkEntityMax(nextQEdge) {
    const max = config.ENTITY_MAX;
    //(MAX) --- (0) not allowed
    //(MAX) --- (MAX) not allowed
    //(MAX) --- (2) allowed, (2 will be used)
    let sub_count = nextQEdge.object.getEntityCount();
    let obj_count = nextQEdge.subject.getEntityCount();
    debug(`Checking entity max : (${sub_count})--(${obj_count})`);
    if (
      (obj_count == 0 && sub_count > max) ||
      (obj_count > max && sub_count == 0) ||
      (obj_count > max && sub_count > max)
    ) {
      throw new BTEError(`Max number of entities exceeded (${max}) in '${nextQEdge.getID()}'`);
    }
  }

  preSendOffCheck(nextQEdge) {
    // next: qEdge
    //check that edge entities are or have potential to stay
    //under max limit
    this.checkEntityMax(nextQEdge);
    if (nextQEdge.object.entity_count && nextQEdge.subject.entity_count) {
      //if at the time of being queried the edge has both
      //obj and sub entity counts
      //chose obj/suj lower entity count for query
      nextQEdge.chooseLowerEntityValue();
      this.logs.push(new LogEntry('DEBUG', null, `Next qEdge will pick lower entity value to use for query.`).getLog());
    } else if (
      (nextQEdge.object.entity_count && !nextQEdge.subject.entity_count) ||
      (!nextQEdge.object.entity_count && !nextQEdge.subject.entity_count)
    ) {
      debug(`(5) Checking direction of edge with one set of entities...`);
      //check direction is correct if edge only has one set of entities
      //before sending off
      nextQEdge.reverse = nextQEdge.subject.entity_count ? false : true;
    }
    this.logs.push(
      new LogEntry('DEBUG', null, `Edge manager is sending next qEdge '${nextQEdge.getID()}' for execution.`).getLog(),
    );
    this.logEntityCounts();
    return nextQEdge;
  }

  getEdgesNotExecuted() {
    //simply returns a number of edges not marked as executed
    let found = this._qEdges.filter((edge) => !edge.executed);
    let not_executed = found.length;
    if (not_executed) debug(`(4) Edges not yet executed = ${not_executed}`);
    return not_executed;
  }

  _filterEdgeRecords(qEdge) {
    let keep = [];
    let records = qEdge.records;
    let subjectCuries = Array.isArray(qEdge.subject.curie) ? qEdge.subject.curie.map(s => s.toLowerCase()) : qEdge.subject.curie.toLowerCase();
    let objectCuries =  Array.isArray(qEdge.object.curie) ? qEdge.object.curie.map(s => s.toLowerCase()) : qEdge.object.curie.toLowerCase();
    debug(
      `'${qEdge.getID()}' Reversed[${qEdge.reverse}] (${JSON.stringify(subjectCuries.length || 0)})` +
        `--(${JSON.stringify(objectCuries.length || 0)}) entities / (${records.length}) records.`,
    );
    // debug(`IDS SUB ${JSON.stringify(sub_count)}`)
    // debug(`IDS OBJ ${JSON.stringify(obj_count)}`)
    let execSubjectCuries = qEdge.reverse ? objectCuries : subjectCuries;
    let execObjectCuries = qEdge.reverse ? subjectCuries : objectCuries;

    records.forEach((record) => {
      //check sub curies against $input ids
      let subjectIDs = new Set();
      let objectIDs = new Set();
      let objectMatch = false;
      let subjectMatch = false;

      //compare record I/O ids against edge node ids
      // #1 check equivalent ids
      record.subject.equivalentCuries.forEach((curie) => {
        subjectIDs.add(curie?.toLowerCase());
      });
      record.object.equivalentCuries.forEach((curie) => {
        objectIDs.add(curie?.toLowerCase());
      });
      // #2 ensure we have the primaryID
      subjectIDs.add(record.subject.curie?.toLowerCase());
      objectIDs.add(record.object.curie?.toLowerCase());
      // #3 make sure we at least have the original
      subjectIDs.add(record.subject.original?.toLowerCase());
      objectIDs.add(record.object.original?.toLowerCase());
      // check ids
      subjectMatch = _.intersection([...subjectIDs], execSubjectCuries).length;
      objectMatch = _.intersection([...objectIDs], execObjectCuries).length;
      //if both ends match then keep record
      if (subjectMatch && objectMatch) {
        keep.push(record);
      }
    });
    debug(`'${qEdge.getID()}' dropped (${records.length - keep.length}) records.`);
    this.logs.push(
      new LogEntry(
        'DEBUG',
        null,
        `'${qEdge.getID()}' kept (${keep.length}) / dropped (${records.length - keep.length}) records.`,
      ).getLog(),
    );
    return keep;
  }

  collectRecords() {
    //go through edges and collect records organized by edge
    let recordsByQEdgeID = {};
    //all res merged
    let combinedRecords = [];
    let brokenChain = false;
    let brokenEdges = [];
    debug(`(11) Collecting records...`);
    //First: go through edges and filter that each edge is holding
    this._qEdges.forEach((qEdge) => {
      let qEdgeID = qEdge.getID();
      let filteredRecords = qEdge.records.map((record) => record.queryDirection());
      if (filteredRecords.length == 0) {
        this.logs.push(new LogEntry('WARNING', null, `Warning: qEdge '${qEdgeID}' resulted in (0) records.`).getLog());
        brokenChain = true;
        brokenEdges.push(qEdgeID);
      }
      this.logs = [...this.logs, ...qEdge.logs];
      //collect records
      combinedRecords = combinedRecords.concat(filteredRecords);
      let connections = qEdge.subject.getConnections().concat(qEdge.object.getConnections());
      connections = connections.filter((id) => id !== qEdgeID);
      connections = new Set(connections);
      recordsByQEdgeID[qEdgeID] = {
        records: filteredRecords,
        connected_to: [...connections],
      };
      debug(`(11) '${qEdgeID}' keeps (${filteredRecords.length}) records!`);
      this.logs.push(new LogEntry('INFO', null, `'${qEdgeID}' keeps (${filteredRecords.length}) records!`).getLog());
      debug(`----------`);
    });
    if (brokenChain) {
      recordsByQEdgeID = {};
      this.logs.push(
        new LogEntry(
          'WARNING',
          null,
          `qEdges ${JSON.stringify(brokenEdges)} ` + `resulted in (0) records. No complete paths can be formed.`,
        ).getLog(),
      );
      debug(
        `(12) qEdges ${JSON.stringify(brokenEdges)} ` + `resulted in (0) records. No complete paths can be formed.`,
      );
    }
    //Organized by edge: update query records
    this._organizedRecords = recordsByQEdgeID;
    debug(`(12) Collected records for: ${JSON.stringify(Object.keys(this._organizedRecords))}!`);
    //Combined: update query_graph
    this._records = combinedRecords;
    // var fs = require('fs');
    // fs.writeFile("organized_records.json", JSON.stringify(records, function( key, value) {
    //     if( key == 'records') { return '$records'}
    //     else {return value;}
    //     }), function(err) {
    //     if (err) {
    //         console.log(err);
    //     }
    // });
    debug(`(12) Collected (${this._records.length}) records!`);
    this.logs.push(new LogEntry('DEBUG', null, `Edge manager collected (${this._records.length}) records!`).getLog());
  }

  updateEdgeRecords(currentQEdge) {
    //1. filter edge records based on current status
    let filteredRecords = this._filterEdgeRecords(currentQEdge);
    //2.trigger node update / entity update based on new status
    currentQEdge.storeRecords(filteredRecords);
  }

  updateNeighborsEdgeRecords(currentQEdge) {
    //update and filter only immediate neighbors
    debug(`Updating neighbors...`);
    let currentQEdgeID = currentQEdge.getID();
    //get neighbors of this edges subject that are not this edge
    let left_connections = currentQEdge.subject.getConnections();
    left_connections = left_connections.filter((qEdgeID) => qEdgeID !== currentQEdgeID);
    //get neighbors of this edges object that are not this edge
    let right_connections = currentQEdge.object.getConnections();
    right_connections = right_connections.filter((qEdgeID) => qEdgeID !== currentQEdgeID);
    debug(`(${left_connections})<--edge neighbors-->(${right_connections})`);
    if (left_connections.length) {
      //find edge by id
      left_connections.forEach((qEdgeID) => {
        let edge = this._qEdges.find((edge) => edge.getID() == qEdgeID);
        if (edge && edge.records.length) {
          debug(`Updating "${edge.getID()}" neighbor edge of ${currentQEdgeID}`);
          debug(`Updating neighbor (X)<----()`);
          this.updateEdgeRecords(edge);
        }
      });
    }

    if (right_connections.length) {
      //find edge by id
      right_connections.forEach((neighbor_id) => {
        let edge = this._qEdges.find((edge) => edge.getID() == neighbor_id);
        if (edge && edge.records.length) {
          debug(`Updating "${edge.getID()}" neighbor edge of ${currentQEdgeID}`);
          debug(`Updating neighbor ()---->(X)`);
          this.updateEdgeRecords(edge);
        }
      });
    }
  }

  updateAllOtherEdges(currentQEdge) {
    //update and filter all other edges
    debug(`Updating all other edges...`);
    let currentQEdgeID = currentQEdge.getID();
    this._qEdges.forEach((qEdge) => {
      if (qEdge.getID() !== currentQEdgeID && qEdge.records.length) {
        debug(`Updating "${qEdge.getID()}"...`);
        this.updateEdgeRecords(qEdge);
        this.updateEdgeRecords(currentQEdge);
      }
    });
  }

  _createBatchQueryHandler(qEdge, metaKG) {
    let handler = new BatchEdgeQueryHandler(metaKG, this.resolveOutputIDs, {
        caching: this.options.caching,
        submitter: this.options.submitter,
        recordHashEdgeAttributes: config.EDGE_ATTRIBUTES_USED_IN_RECORD_HASH,
      });
      handler.setEdges(qEdge);
      return handler;
  }

  async executeEdges() {
    const unavailableAPIs = {};
    while (this.getEdgesNotExecuted()) {
      //next available/most efficient edge
      let currentQEdge = this.getNext();
      //crate queries from edge
      let queryBatchHandler = this._createBatchQueryHandler(currentQEdge, this._metaKG);
      this.logs.push(
        new LogEntry(
          'INFO',
          null,
          `Executing ${currentQEdge.getID()}${currentQEdge.isReversed() ? ' (reversed)' : ''}: ${
            currentQEdge.subject.id
          } ${currentQEdge.isReversed() ? '<--' : '-->'} ${currentQEdge.object.id}`,
        ).getLog(),
      );
      debug(`(5) Executing current edge >> "${currentQEdge.getID()}"`);
      //execute current edge query
      let queryRecords = await queryBatchHandler.query(queryBatchHandler.qEdges, unavailableAPIs);
      this.logs = [...this.logs, ...queryBatchHandler.logs];
      if (queryRecords === undefined) return;
      // create an edge execution summary
      let success = 0,
        fail = 0,
        total = 0;
      let cached = this.logs.filter(
        ({ data }) => data?.qEdgeID === currentQEdge.id && data?.type === 'cacheHit',
      ).length;
      this.logs
        .filter(({ data }) => data?.qEdgeID === currentQEdge.id && data?.type === 'query')
        .forEach(({ data }) => {
          !data.error ? success++ : fail++;
          total++;
        });
      this.logs.push(
        new LogEntry(
          'INFO',
          null,
          `${currentQEdge.id} execution: ${total} queries (${success} success/${fail} fail) and (${cached}) cached qEdges return (${queryRecords.length}) records`,
          {},
        ).getLog(),
      );
      if (queryRecords.length === 0) {
        this._logSkippedQueries(unavailableAPIs);
        debug(`(X) Terminating..."${currentQEdge.getID()}" got 0 records.`);
        this.logs.push(
          new LogEntry(
            'WARNING',
            null,
            `qEdge (${currentQEdge.getID()}) got 0 records. Your query terminates.`,
          ).getLog(),
        );
        return;
      }
      // storing records will trigger a node entity count update
      currentQEdge.storeRecords(queryRecords);
      // filter records
      this.updateEdgeRecords(currentQEdge);
      // update and filter neighbors
      this.updateAllOtherEdges(currentQEdge);
      // check that any records are kept
      if (!currentQEdge.records.length) {
        this._logSkippedQueries(unavailableAPIs);
        debug(`(X) Terminating..."${currentQEdge.getID()}" kept 0 records.`);
        this.logs.push(
          new LogEntry(
            'WARNING',
            null,
            `qEdge (${currentQEdge.getID()}) kept 0 records. Your query terminates.`,
          ).getLog(),
        );
        return;
      }
      // edge all done
      currentQEdge.executed = true;
      debug(`(10) Edge successfully queried.`);
    }
    this._logSkippedQueries(unavailableAPIs);
    // collect and organize records
    this.collectRecords();
    // dump records if set to do so
    if (process.env.DUMP_RECORDS) {
      await this.dumpRecords(this.getRecords());
    }
    return true;
  }
};
