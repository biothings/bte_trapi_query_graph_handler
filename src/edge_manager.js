const _ = require('lodash');
const LogEntry = require('./log_entry');
const debug = require('debug')('bte:biothings-explorer-trapi:edge-manager');

module.exports = class EdgeManager {
    constructor(edges) {
        // flatten list of all edges available
        this.edges = _.flatten(Object.values(edges));
        this.logs = [];
        this.results = [];
        this.init();
    }

    init() {
        debug(`(3) Edge manager is managing ${this.edges.length} edges.`);
        this.logs.push(
            new LogEntry(
                'DEBUG',
                null,
                `Edge manager is managing ${this.edges.length} edges.`,
            ).getLog(),
        );
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
                    `Edge manager cannot get next edge, ` +
                    `(${available_edges} )available edges found.`,
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
            return this.preSendOffCheck(all_empty[0]);
        }
        debug(`(5) Sending next edge '${next.getID()}' ` +
        `WITH entity count...(${next.subject_entity_count || next.object_entity_count})`);
        return this.preSendOffCheck(next);
    }

    logEntityCounts() {
        this.edges.forEach((edge) => {
            debug(`'${edge.getID()}'` +
            ` : (${edge.subject_entity_count || 0}) ` +
            `${edge.reverse ? '<--' : '-->'}` +
            ` (${edge.object_entity_count || 0})`);
        });
    }

    refreshEdges() {
        //this can be used to trigger a refresh of class attrs
        debug(`(9) Refreshing edges...`);
        //update edges entity counts
        this.edges.forEach(edge => edge.updateEntityCounts());
    }

    preSendOffCheck(next) {
        if (next.requires_entity_count_choice) {
            //if at the time of being queried the edge has both
            //obj and sub entity counts
            //chose obj/suj lower entity count for query
            next.chooseLowerEntityValue();
            this.logs.push(
                new LogEntry('DEBUG', 
                null, 
                `Next edge will pick lower entity value to use for query.`).getLog(),
            );
        }
        this.logs.push(
            new LogEntry('DEBUG', 
            null, 
            `Edge manager is sending next edge '${next.getID()}' for execution.`).getLog(),
        );
        this.logEntityCounts();
        return next;
    }

    getEdgesNotExecuted() {
        //simply returns a number of edges not marked as executed
        let found = this.edges.filter(edge => !edge.executed);
        let not_executed = found.length;
        if(not_executed) debug(`(4) Edges not yet executed = ${not_executed}`);
        return not_executed;
    }

    _filterEdgeResults(edge) {
        let keep = [];
        let results = edge.results;
        let sub_curies = edge.subject.curie;
        let obj_curies = edge.object.curie;
        debug(`'${edge.getID()}' R(${edge.reverse}) (${results.length}) results`);
        debug(`'${edge.getID()}' (${JSON.stringify(sub_curies || [])}) sub curies`);
        debug(`'${edge.getID()}' (${JSON.stringify(obj_curies || [])}) obj curies`);

        let objs = edge.reverse ? sub_curies : obj_curies;
        let subs = edge.reverse ? obj_curies : sub_curies;

        results.forEach((res) => {
            //check sub curies against $input ids
            let ids = new Set();
            let outputMatch = false;
            let inputMatch = false;
            res.$input.obj.forEach((o) => {
                if (Object.hasOwnProperty.call(o, '_dbIDs')) {
                    for (const prefix in o._dbIDs) {
                        ids.add(prefix + ':' + o._dbIDs[prefix])
                    }
                }else if(Object.hasOwnProperty.call(o, 'curie')) {
                    ids.add(o.curie)
                }else{
                    ids.add(res.$input.original)
                }
                //check ids
                // debug(`CHECKING INPUTS ${JSON.stringify([...ids])}`);
                // debug(`AGAINST ${JSON.stringify(subs)}`);
                inputMatch = _.intersection([...ids], subs).length;
            });
            //check obj curies against $output ids
            let o_ids = new Set();
            res.$output.obj.forEach((o) => {
                if (Object.hasOwnProperty.call(o, '_dbIDs')) {
                    for (const prefix in o._dbIDs) {
                        o_ids.add(prefix + ':' + o._dbIDs[prefix])
                    }
                }else if(Object.hasOwnProperty.call(o, 'curie')) {
                    o_ids.add(o.curie)
                }else{
                    o_ids.add(res.$output.original)
                }
                //check ids
                // debug(`CHECKING OUTPUTS ${JSON.stringify([...o_ids])}`);
                // debug(`AGAINST ${JSON.stringify(objs)}`);
                outputMatch = _.intersection([...o_ids], objs).length;
            });
            if (inputMatch && outputMatch) {
                keep.push(res);
            }
        });
        debug(`'${edge.getID()}' dropped (${results.length - keep.length}) results.`);
        debug(`---------`);
        this.logs.push(
            new LogEntry(
                'DEBUG',
                null,
                `'${edge.getID()}' kept (${keep.length}) / dropped (${results.length - keep.length}) results.`
            ).getLog(),
        );
        return keep;
    }

    gatherResults() {
        //go through edges and collect all results
        let results = [];
        //refresh to get latest entity counts
        this.refreshEdges();
        debug(`(11) Collecting results...`);
        //First: go through edges and filter that each edge is holding
        this.edges.forEach((edge) => {
            let filtered_res = this._filterEdgeResults(edge);
            if (filtered_res.length == 0) {
                this.logs.push(
                    new LogEntry(
                        'DEBUG',
                        null,
                        `Warning: Edge '${edge.getID()}' resulted in (0) results.`
                    ).getLog(),
                );
            }
            this.logs = [...this.logs, ...edge.logs];
            //store filtered results
            edge.results = filtered_res;
            //collect results
            results = results.concat(filtered_res);
            debug(`(11) '${edge.getID()}' keeps (${filtered_res.length}) results!`);
            this.logs.push(
                new LogEntry(
                    'DEBUG',
                    null,
                    `'${edge.getID()}' keeps (${filtered_res.length}) results!`
                ).getLog(),
            );
            debug(`----------`);
        });
        //Second: collected results
        this.results = results;
        debug(`(12) Collected (${this.results.length}) results!`);
        this.logs.push(
            new LogEntry(
                'DEBUG',
                null,
                `Edge manager collected (${this.results.length}) results!`
            ).getLog(),
        );
    }
};
