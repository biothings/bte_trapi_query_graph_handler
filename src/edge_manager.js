const _ = require('lodash');
const LogEntry = require('./log_entry');
const debug = require('debug')('bte:biothings-explorer-trapi:edge-manager');

module.exports = class EdgeManager {
    constructor(edges, kg) {
        // flatten list of all edges available
        this.edges = _.flatten(Object.values(edges));;
        debug(`(5) Edge manager will manage ${this.edges.length} edges.`);
        this.kg = kg;
        this.resolveOutputIDs = true;
        this.logs = [];
    }

    processAndUpdateEdgeEntityCount(res, edges) {
        //read results from current edge and
        //update matching edges entity count before the 
        //next edge is selected
        debug(`(6) Processing ${res.length} results.`);
        debug(`(6) Processing from edge ${JSON.stringify(edges)}.`);
    }

    getNext() {
        //returns next edge with lowest entity count on
        //either object or subject OR no count last

        // available not yet executed
        let available_edges = this.edges
        .filter(edge => !edge.executed);
        //safeguard for making sure there's available
        //edges when calling getNext
        if (available_edges.length == 0) {
            debug(`(5) Error: ${available_edges} available edges found.`);
            this.logs.push(
                new LogEntry(
                    'DEBUG',
                    null,
                    `Cannot get next edge, ${available_edges} available edges found.`,
                ).getLog(),
            );
        }
        //begin search
        let next;
        let lowest_entity_count;
        let current_obj_lowest = 0;
        let current_sub_lowest = 0;
        available_edges.forEach((edge) => {
            if (
                edge && 
                edge.object_entity_count
                ) {
                current_obj_lowest = edge.object_entity_count;
                if (!lowest_entity_count) {
                    //set current lowest if none
                    lowest_entity_count = current_obj_lowest;
                }
                if (current_obj_lowest <= lowest_entity_count) {
                    //lowest is now object count
                    next = edge;
                }
            }
            if (
                edge && 
                edge.subject_entity_count &&
                edge.subject_entity_count > 0
                ) {
                current_sub_lowest = edge.subject_entity_count;
                if (!lowest_entity_count) {
                    //set current lowest if none
                    lowest_entity_count = current_sub_lowest;
                }
                if (current_sub_lowest <= lowest_entity_count) {
                    //lowest is now subject count
                    next = edge;
                }
            }
        });
        if (!next) {
            //if no edge with count found pick the first empty
            //edge available
            let all_empty = available_edges
            .filter((edge) => !edge.object_entity_count && !edge.subject_entity_count);
            if (all_empty.length == 0) {
                debug(`(5) Error: No available edges found.`);
                this.logs.push(
                    new LogEntry(
                        'DEBUG',
                        null,
                        `Cannot get next edge, No available edges found.`,
                    ).getLog(),
                );
            }
            debug(`(5) Sending next edge '${all_empty[0].getID()}' with NO entity count.`);
            return all_empty[0];
        }
        debug(`(5) Sending next edge '${next.getID()}' WITH entity count...`);
        return next;
    }

    //old implementation
    getNext_2() {
        // available not yet executed
        let available_edges = this.edges
        .filter(edge => !edge.executed);
        if (available_edges.length == 0) {
            debug(`(5) Error: ${available_edges} available edges found.`);
            this.logs.push(
                new LogEntry(
                    'DEBUG',
                    null,
                    `Cannot get next edge, ${available_edges} available edges found.`,
                ).getLog(),
            );
        }
        // check edges with lowest object entity counts
        // (1) ----> ()
        let with_object_entity_counts = available_edges
        .filter(edge => {
            if(edge.object_entity_count && !edge.subject_entity_count){
                return true;
            }else {
                return false;
            }
        });
        if (with_object_entity_counts.length) {
            let found_s = with_object_entity_counts.reduce(function(prev, curr) {
                return prev.object_entity_count < curr.object_entity_count ? prev : curr;
            });
            debug(`(5) Edge with lowest SOURCE entities is next ${JSON.stringify(found_s)}`);
            return found_s;
        }else{
            // check edges with lowest subject entity counts
            // () ----> (1)
            let with_subject_entity_counts = available_edges
            .filter(edge => {
                if(edge.subject_entity_count && !edge.object_entity_count){
                    return true;
                }else{
                    return false;
                }
            });
            if (with_subject_entity_counts.length) {
                let found_t = with_subject_entity_counts.reduce(function(prev, curr) {
                    return prev.subject_entity_count < curr.subject_entity_count ? prev : curr;
                });
                debug(`(5) Edge with lowest TARGET entities is next ${JSON.stringify(found_t)}`);
                return found_t;
            }else{
                // check edges with both object and subject entity counts
                // (2) ----> (3)
                let with_both= available_edges
                .filter(edge => {
                    if(edge.subject_entity_count && edge.object_entity_count){
                        return true;
                    }else{
                        return false;
                    }
                });
                if (with_both.length) {
                    let found_b = with_both.reduce(function(prev, curr) {
                        return prev.object_entity_count < curr.object_entity_count ? prev : curr;
                    });
                    debug(`(5) Edge with BOTH object and subject entities is next ${JSON.stringify(found_b)}`);
                    return found_b;
                }else{
                    // check edges with no counts and pick first found
                    // () ----> ()
                    //NOTE. this should not happen as each time
                    //all nodes are updated and should have a count
                    let left = available_edges
                    .filter(edge => {
                        if(!edge.object_entity_count && !edge.subject_entity_count ){
                            return true;
                        }else{
                            return false;
                        }
                    });
                    if (left.length) {
                        debug(`(5) Edge with no entity counts is next ${JSON.stringify(left[0])}`);
                        return left[0];
                    }
                }
            }
        }
    }

    getEdgesNotExecuted() {
        //simply returns a number of edges not marked as executed
        let found = this.edges.filter(edge => !edge.executed);
        let not_executed = found.length;
        if(not_executed) debug(`(4) Edges not yet executed = ${not_executed}`);
        return not_executed;
    }
};
