const _ = require('lodash');
const LogEntry = require('./log_entry');
const BTEError = require('./exceptions/bte_error');
const debug = require('debug')('bte:biothings-explorer-trapi:edge-manager');
const config = require('./config');


module.exports = class QueryExecutionEdgeManager {
    constructor(edges) {
        // flatten list of all edges available
        this._qXEdges = _.flatten(Object.values(edges));
        this.logs = [];
        this._records = [];
        //organized by edge with refs to connected edges
        this._organizedRecords = {};
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
        debug(`(3) Edge manager is managing ${this._qXEdges.length} qEdges.`);
        this.logs.push(
            new LogEntry(
                'DEBUG',
                null,
                `Edge manager is managing ${this._qXEdges.length} qEdges.`,
            ).getLog(),
        );
    }

    getNext() {
        //returns next edge with lowest entity count on
        //either object or subject OR no count last
        // available not yet executed
        let available_edges = this._qXEdges
        .filter(qXEdge => !qXEdge.executed);
        //safeguard for making sure there's available
        //edges when calling getNext
        if (available_edges.length == 0) {
            debug(`(5) Error: ${available_edges} available qXEdges found.`);
            this.logs.push(
                new LogEntry(
                    'DEBUG',
                    null,
                    `Edge manager cannot get next qEdge, ` +
                    `(${available_edges}) available edges found.`,
                ).getLog(),
            );
        }
        //begin search
        let nextQXEdge;
        let lowest_entity_count;
        let current_obj_lowest = 0;
        let current_sub_lowest = 0;
        available_edges.forEach((qXEdge) => {
            if (
                qXEdge &&
                qXEdge.object.entity_count
                ) {
                current_obj_lowest = qXEdge.object.entity_count;
                if (!lowest_entity_count) {
                    //set current lowest if none
                    lowest_entity_count = current_obj_lowest;
                }
                if (current_obj_lowest <= lowest_entity_count) {
                    //lowest is now object count
                    nextQXEdge = qXEdge;
                }
            }
            if (
                qXEdge &&
                qXEdge.subject.entity_count &&
                qXEdge.subject.entity_count > 0
                ) {
                current_sub_lowest = qXEdge.subject.entity_count;
                if (!lowest_entity_count) {
                    //set current lowest if none
                    lowest_entity_count = current_sub_lowest;
                }
                if (current_sub_lowest <= lowest_entity_count) {
                    //lowest is now subject count
                    nextQXEdge = qXEdge;
                }
            }
        });
        if (!nextQXEdge) {
            //if no edge with count found pick the first empty
            //edge available
            let all_empty = available_edges
            .filter((edge) => !edge.object.entity_count && !edge.subject.entity_count);
            if (all_empty.length == 0) {
                debug(`(5) Error: No available qXEdges found.`);
                this.logs.push(
                    new LogEntry(
                        'DEBUG',
                        null,
                        `Cannot get next edge, No available qEdges found.`,
                    ).getLog(),
                );
            }
            debug(`(5) Sending next edge '${all_empty[0].getID()}' with NO entity count.`);
            return this.preSendOffCheck(all_empty[0]);
        }
        debug(`(5) Sending next edge '${nextQXEdge.getID()}' ` +
        `WITH entity count...(${nextQXEdge.subject.entity_count || nextQXEdge.object.entity_count})`);
        return this.preSendOffCheck(nextQXEdge);
    }

    logEntityCounts() {
        this._qXEdges.forEach((qXEdge) => {
            debug(`'${qXEdge.getID()}'` +
            ` : (${qXEdge.subject.entity_count || 0}) ` +
            `${qXEdge.reverse ? '<--' : '-->'}` +
            ` (${qXEdge.object.entity_count || 0})`);
        });
    }

    checkEntityMax(nextQXedge) {
        const max = config.ENTITY_MAX;
        //(MAX) --- (0) not allowed
        //(MAX) --- (MAX) not allowed
        //(MAX) --- (2) allowed, (2 will be used)
        let sub_count = nextQXedge.object.getEntityCount();
        let obj_count = nextQXedge.subject.getEntityCount();
        debug(`Checking entity max : (${sub_count})--(${obj_count})`);
        if (
            (obj_count == 0 && sub_count > max) ||
            (obj_count > max && sub_count == 0) ||
            (obj_count > max && sub_count > max)
        ) {
            throw new BTEError(
                `Max number of entities exceeded (${max}) in '${nextQXedge.getID()}'`
                );
        }
    }

    preSendOffCheck(nextQXEdge) {
        // next: qXEdge
        //check that edge entities are or have potential to stay
        //under max limit
        this.checkEntityMax(nextQXEdge);
        if (nextQXEdge.object.entity_count && nextQXEdge.subject.entity_count) {
            //if at the time of being queried the edge has both
            //obj and sub entity counts
            //chose obj/suj lower entity count for query
            nextQXEdge.chooseLowerEntityValue();
            this.logs.push(
                new LogEntry('DEBUG',
                null,
                `Next qEdge will pick lower entity value to use for query.`).getLog(),
            );
        }
        else if (
            (nextQXEdge.object.entity_count && !nextQXEdge.subject.entity_count) ||
            (!nextQXEdge.object.entity_count && !nextQXEdge.subject.entity_count)
        ) {
            debug(`(5) Checking direction of edge with one set of entities...`);
            //check direction is correct if edge only has one set of entities
            //before sending off
            nextQXEdge.reverse = nextQXEdge.subject.entity_count ? false : true;
        }
        this.logs.push(
            new LogEntry('DEBUG',
            null,
            `Edge manager is sending next qEdge '${nextQXEdge.getID()}' for execution.`).getLog(),
        );
        this.logEntityCounts();
        return nextQXEdge;
    }

    getEdgesNotExecuted() {
        //simply returns a number of edges not marked as executed
        let found = this._qXEdges.filter(edge => !edge.executed);
        let not_executed = found.length;
        if(not_executed) debug(`(4) Edges not yet executed = ${not_executed}`);
        return not_executed;
    }

    _filterEdgeRecords(qXEdge) {
        let keep = [];
        let records = qXEdge.records;
        let sub_count = qXEdge.subject.curie;
        let obj_count = qXEdge.object.curie;
        debug(`'${qXEdge.getID()}' Reversed[${qXEdge.reverse}] (${JSON.stringify(sub_count.length || 0)})` +
        `--(${JSON.stringify(obj_count.length || 0)}) entities / (${records.length}) records.`);
        // debug(`IDS SUB ${JSON.stringify(sub_count)}`)
        // debug(`IDS OBJ ${JSON.stringify(obj_count)}`)
        let object_node_ids = qXEdge.reverse ? sub_count : obj_count;
        let subject_node_ids = qXEdge.reverse ? obj_count : sub_count;

        records.forEach((record) => {
            //check sub curies against $input ids
            let ids = new Set();
            let outputMatch = false;
            let inputMatch = false;
            record.$input.obj.forEach((o) => {
                //compare record I/O ids against edge node ids
                //#1 check equivalent ids
                if (Object.hasOwnProperty.call(o, '_dbIDs')) {
                    for (const prefix in o._dbIDs) {
                        //check if array
                        if (Array.isArray(o._dbIDs[prefix])) {
                            o._dbIDs[prefix].forEach((single_alias) => {
                                if (single_alias) {
                                    if (single_alias.includes(':')) {
                                        //value already has prefix
                                        ids.add(single_alias);
                                    } else {
                                        //concat with prefix
                                        ids.add(prefix + ':' + single_alias);
                                    }
                                }
                            });
                        } else {
                            if (o._dbIDs[prefix].includes(':')) {
                                //value already has prefix
                                ids.add(o._dbIDs[prefix]);
                            } else {
                                //concat with prefix
                                ids.add(prefix + ':' + o._dbIDs[prefix]);
                            }
                        }
                    }
                }
                //else #2 check curie
                else if(Object.hasOwnProperty.call(o, 'curie')) {
                    ids.add(o.curie);
                }
                //#3 last resort check original
                else {
                    ids.add(record.$input.original);
                }
                //check ids
                inputMatch = _.intersection([...ids], subject_node_ids).length;
            });
            //check obj curies against $output ids
            let o_ids = new Set();
            record.$output.obj.forEach((o) => {
                //#1 check equivalent ids
                if (Object.hasOwnProperty.call(o, '_dbIDs')) {
                    for (const prefix in o._dbIDs) {
                        //check if array
                        if (Array.isArray(o._dbIDs[prefix])) {
                            o._dbIDs[prefix].forEach((single_alias) => {
                                if (single_alias) {
                                    if (single_alias.includes(':')) {
                                        //value already has prefix
                                        o_ids.add(single_alias);
                                    } else {
                                        //concat with prefix
                                        o_ids.add(prefix + ':' + single_alias);
                                    }
                                }
                            });
                        } else {
                            if (o._dbIDs[prefix].includes(':')) {
                                //value already has prefix
                                o_ids.add(o._dbIDs[prefix]);
                            } else {
                                //concat with prefix
                                o_ids.add(prefix + ':' + o._dbIDs[prefix]);
                            }
                        }
                    }
                }
                //else #2 check curie
                else if(Object.hasOwnProperty.call(o, 'curie')) {
                    o_ids.add(o.curie);
                }
                //#3 last resort check original
                else {
                    o_ids.add(record.$output.original);
                }
                //check ids
                outputMatch = _.intersection([...o_ids], object_node_ids).length;
            });
            //if both ends match then keep record
            if (inputMatch && outputMatch) {
                keep.push(record);
            }
        });
        debug(`'${qXEdge.getID()}' dropped (${records.length - keep.length}) records.`);
        this.logs.push(
            new LogEntry(
                'DEBUG',
                null,
                `'${qXEdge.getID()}' kept (${keep.length}) / dropped (${records.length - keep.length}) records.`
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
        this._qXEdges.forEach((qXEdge) => {
            let qEdgeID = qXEdge.getID();
            let filteredRecords = qXEdge.records;
            if (filteredRecords.length == 0) {
                this.logs.push(
                    new LogEntry(
                        'WARNING',
                        null,
                        `Warning: qEdge '${qEdgeID}' resulted in (0) records.`
                    ).getLog(),
                );
                brokenChain = true;
                brokenEdges.push(qEdgeID);
            }
            this.logs = [...this.logs, ...qXEdge.logs];
            //collect records
            combinedRecords = combinedRecords.concat(filteredRecords);
            let connections = qXEdge.qEdge.subject.getConnections().concat(qXEdge.qEdge.object.getConnections());
            connections = connections.filter(id => id !== qEdgeID);
            connections = new Set(connections);
            recordsByQEdgeID[qEdgeID] = {
                records: filteredRecords,
                connected_to: [...connections],
            }
            debug(`(11) '${qEdgeID}' keeps (${filteredRecords.length}) records!`);
            this.logs.push(
                new LogEntry(
                    'INFO',
                    null,
                    `'${qEdgeID}' keeps (${filteredRecords.length}) records!`
                ).getLog(),
            );
            debug(`----------`);
        });
        if (brokenChain) {
            recordsByQEdgeID = {};
            this.logs.push(
                new LogEntry(
                    'WARNING',
                    null,
                    `qEdges ${JSON.stringify(brokenEdges)} ` +
                    `resulted in (0) records. No complete paths can be formed.`
                ).getLog(),
            );
            debug(`(12) qXEdges ${JSON.stringify(brokenEdges)} ` +
            `resulted in (0) records. No complete paths can be formed.`);
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
        this.logs.push(
            new LogEntry(
                'DEBUG',
                null,
                `Edge manager collected (${this._records.length}) records!`
            ).getLog(),
        );
    }

    updateEdgeRecords(currentQXEdge) {
        //1. filter edge records based on current status
        let filteredRecords = this._filterEdgeRecords(currentQXEdge);
        //2.trigger node update / entity update based on new status
        currentQXEdge.storeRecords(filteredRecords);
    }

    updateNeighborsEdgeRecords(currentQXEdge) {
        //update and filter only immediate neighbors
        debug(`Updating neighbors...`);
        let currentQEdgeID = currentQXEdge.getID();
        //get neighbors of this edges subject that are not this edge
        let left_connections = currentQXEdge.qEdge.subject.getConnections();
        left_connections = left_connections.filter((qEdgeID) => qEdgeID !== currentQEdgeID);
        //get neighbors of this edges object that are not this edge
        let right_connections = currentQXEdge.qEdge.object.getConnections();
        right_connections = right_connections.filter((qEdgeID) => qEdgeID !== currentQEdgeID);
        debug(`(${left_connections})<--edge neighbors-->(${right_connections})`);
        if (left_connections.length) {
            //find edge by id
            left_connections.forEach((qEdgeID) => {
                let edge = this._qXEdges.find((edge) => edge.getID() == qEdgeID);
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
                let edge = this._qXEdges.find((edge) => edge.getID() == neighbor_id);
                if (edge && edge.records.length) {
                    debug(`Updating "${edge.getID()}" neighbor edge of ${currentQEdgeID}`);
                    debug(`Updating neighbor ()---->(X)`);
                    this.updateEdgeRecords(edge);
                }
            });
        }
    }

    updateAllOtherEdges(currentQXEdge) {
        //update and filter all other edges
        debug(`Updating all other edges...`);
        let currentQEdgeID = currentQXEdge.getID();
        this._qXEdges.forEach((qXEdge) => {
            if (qXEdge.getID() !== currentQEdgeID && qXEdge.records.length) {
                debug(`Updating "${qXEdge.getID()}"...`);
                this.updateEdgeRecords(qXEdge);
                this.updateEdgeRecords(currentQXEdge);
            }
        });
    }
};
