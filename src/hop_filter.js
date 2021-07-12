const debug = require('debug')('bte:biothings-explorer-trapi:KG_Filter');
const id_resolver = require('biomedical_id_resolver');
const LogEntry = require('./log_entry');

module.exports = class HopFilter {
    constructor(res = {}, query_edges = {}) {
        this.query_edges = query_edges;
        this.original_res = res;
        this.logs = [];
        this.filtered_res = [];
    }

    /**
    * @private
    */
     async _getEquivalentIDs(curies) {
        const resolver = new id_resolver.Resolver('biolink');
        const equivalentIDs = await resolver.resolve(curies);
        return equivalentIDs;
    }

    /**
    * @private
    */
     _createResolvableItem(item) {
        //creates a valid object from query node info
        //to get equivalent ids from id resolver
        //from: "CHEMBL.COMPOUND:CHEMBL744"
        //to: { "ChemicalSubstance": ["CHEMBL.COMPOUND:CHEMBL744"] }
        let resolveThis = {};
        let r_key = Array.isArray(item['category']) ?
        item['category'][0].split(":")[1] :
        item['category'].split(":")[1];
        let r_value = item['curie'];
        resolveThis[r_key] = r_value;
        return resolveThis;
    }

    /**
    * @private
    */
     async _createFiltersFromNode(nodeInfo){
        debug(`node info ${JSON.stringify(nodeInfo)}`);
        //look in original query for node ids
        try {
            let resolvableItem = await this._createResolvableItem(nodeInfo);
            debug(`(3) KGF getting equivalent IDs of ${JSON.stringify(resolvableItem)}`);
            //add results to lis tof filters
            let res = await this._getEquivalentIDs(resolvableItem);
            return this._getIDsFromRes(res);
        } catch (error) {
            debug(`createFiltersFromNode failed: because ${error}`);
        }
    }

    /**
    * @private
    */
     _getIDsFromRes(res) {
        let ids = [];
        for (const key in res) {
            if (Object.hasOwnProperty.call(res[key][0], '_dbIDs')) {
                //object with equivalent ids 
                for (const key_name in res[key][0]['_dbIDs']) {
                    //each id should be: 'NCBIGene:5742'
                    //check if alias is one or many
                    let val = res[key][0]['_dbIDs'][key_name];
                    if (Array.isArray(val)) {
                        val.forEach((v) => {
                            let id = v.includes(":") ? v : key_name + ':' + v;
                            ids.push(id);
                        })
                    } else {
                        let id = val.includes(":") ? val : key_name + ':' + val;
                        ids.push(id);
                    }
                }
            }
        }
        return ids;
    }

    // /**
    // * @private
    // */
    //  _getIDs(allIds) {
    //     let ids = new Set();
    //     for (const key_name in allIds) {
    //         //only collect aliases of ids of interest (eg. obj curie)
    //         //each id should be: 'NCBIGene:5742'
    //         let val = allIds[key_name];
    //         if (Array.isArray(val)) {
    //             val.forEach((v) => {
    //                 let id = v.includes(":") ? v : key_name + ':' + v;
    //                 ids.add(id);
    //             })
    //         } else {
    //             let id = val.includes(":") ? val : key_name + ':' + val;
    //             ids.add(id);
    //         }
    //     }
    //     return [...ids];
    // }

    /**
    * @private
    */
     async _collectEquivalentIDs(qeInfo) {
        let input_e_ids = [];
        let output_e_ids = [];

        input_e_ids = await this._createFiltersFromNode(qeInfo['qEdge']['subject']);
        output_e_ids = await this._createFiltersFromNode(qeInfo['qEdge']['object']);
        
        this.logs.push(
            new LogEntry(
                'DEBUG', 
                null, 
                `Current hop will be filtered using ` +
                `these ids: ${JSON.stringify([...input_e_ids, ...output_e_ids])}`
                ).getLog(),
        );
        return [...input_e_ids, ...output_e_ids];
    }

    /**
    * @private
    */
    async _filterRes(qeInfo) {
        let equivalentIds = await this._collectEquivalentIDs(qeInfo);
        debug(`(4) Hop filters ${JSON.stringify(equivalentIds)}`);
        this.original_res.forEach((result) => {
            if (
                //check source and target exist in restriction filters
                equivalentIds.includes(result['$input']['original']) &&
                equivalentIds.includes(result['$output']['original'])
            ) {
                this.filtered_res.push(result)
            }
        })
        debug(
            `(5) Filtered response from ${this.original_res.length} ` + 
            `down to ${this.filtered_res.length}`
            );
        this.logs.push(
            new LogEntry(
                'DEBUG', 
                null, 
                `Current hop ${qeInfo.qEdge.id} was filtered ` +
                `based on relevancy: ` +
                `from ${this.original_res.length} ` + 
                `down to ${this.filtered_res.length} results.`
                ).getLog(),
        );
        return this.filtered_res;
    }


    /**
    * @private
    */
     _shouldFilter(qeInfo) {
        // debug(`EDGE BEING EXAMINED ${JSON.stringify(qeInfo)}`);
        // check object curie
        let object_curie = qeInfo['qEdge']['object']['curie'] || false;
        let subject_curie = qeInfo['qEdge']['subject']['curie'] || false;
        debug(`(1) Hop goes from "${subject_curie}" to "${object_curie}"`);
        return (object_curie && subject_curie) ? true : false;
    }

    async applyFilter() {
        //this prevents reversed edges from being
        //processed twice since order does not matter
        let processed = new Set();
        this.query_edges.forEach( async (queryEdge) => {
            if (!processed.has(queryEdge.qEdge.id)) {
                //examine and filter res based on each edge
                let should_filter = await this._shouldFilter(queryEdge);
                if (should_filter) {
                    debug(`(2) Hop "${queryEdge.qEdge.id}" is being filtered...`);
                    processed.add(queryEdge.qEdge.id);
                    await this._filterRes(queryEdge);
                }else{
                    // if any one edge is missing curies just return original res
                    // means hop should not be restricted
                    debug(`(5) No filter returned original`);
                    return this.original_res;
                }
            }else{
                debug(`(2) Hop "${queryEdge.qEdge.id}" already processed`);
            }
        });
        debug(`(5) Filtering complete.`);
        return this.filtered_res;
    }
};
