const LogEntry = require('./log_entry');
const debug = require('debug')('bte:biothings-explorer-trapi:edge-manager');

module.exports = class EdgeManager {
    constructor(edges, kg) {
        this.smart_edges = edges;
        this.kg = kg;
        this.resolveOutputIDs = true;
        this.logs = [];
    }

    getNext() {
        // available not yet executed
        let available_edges = Object.values(this.smart_edges)
        .filter(edge => !edge.executed);
        if (available_edges.length == 0) {
            debug(`(5) Error: ${available_edges} available edges found.`);
        }
        // check edges with lowest source entity counts
        let with_source_entity_counts = available_edges
        .filter(edge => edge.source_entity_count);
        if (with_source_entity_counts.length) {
            let found_s = with_source_entity_counts.reduce(function(prev, curr) {
                return prev.source_entity_count < curr.source_entity_count ? prev : curr;
            });
            debug(`(5) Edge with lowest SOURCE entities is next ${JSON.stringify(found_s)}`);
            return found_s;
        }else{
            // check edges with lowest target entity counts
            let with_target_entity_counts = available_edges
            .filter(edge => edge.target_entity_count);
            if (with_target_entity_counts.length) {
                let found_t = with_target_entity_counts.reduce(function(prev, curr) {
                    return prev.target_entity_count < curr.target_entity_count ? prev : curr;
                });
                debug(`(5) Edge with lowest TARGET entities is next ${JSON.stringify(found_t)}`);
                return found_t;
            }else{
                // check edges with no counts and pick first found
                //NOTE. this should not happen as each time
                //all nodes are updated and should have a count
                let left = available_edges
                .filter(edge => (!edge.source_entity_count && !edge.target_entity_count ));
                if (left.length) {
                    debug(`(5) Edge with no entity counts is next ${JSON.stringify(left[0])}`);
                    return left[0];
                }
            }
        }
    }

    getNotExecuted() {
        let not_executed = 0;
        for (const i in this.smart_edges) {
            if (!this.smart_edges[i].executed) {
                not_executed++;
            }
        }
        if(not_executed) debug(`(4) EDGES NOT YET EXECUTED = ${not_executed}`);
        return not_executed;
    }
};
