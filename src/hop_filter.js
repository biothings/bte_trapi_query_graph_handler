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
            let resolvableItem = this._createResolvableItem(nodeInfo);
            debug(`KGF getting equivalent IDs of ${JSON.stringify(resolvableItem)}`);
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
        // let allowed_inputs = qeInfo['qEdge']['subject']['curie'];
        // let allowed_outputs = qeInfo['qEdge']['object']['curie'];
        // debug(`Allowed I ${JSON.stringify(allowed_inputs)}`);
        // debug(`Allowed O ${JSON.stringify(allowed_outputs)}`);

        input_e_ids = await this._createFiltersFromNode(qeInfo['qEdge']['subject']);
        output_e_ids = await this._createFiltersFromNode(qeInfo['qEdge']['object']);

        // allowed_inputs.forEach((input) => {
        //     // debug(`INPUT KEYS ${JSON.stringify(Object.keys(qeInfo['input_equivalent_identifiers']))}`);
        //     for (const i_key in qeInfo['input_equivalent_identifiers']) {
        //         qeInfo['input_equivalent_identifiers'][i_key].forEach((item) => {
        //             if (i_key == input && item && item['_dbIDs']) {   
        //                 debug(`Adding aliases of ${input}`);
        //                 input_e_ids = input_e_ids.concat(this._getIDs(item['_dbIDs']))
        //             }
        //         })
        //     }
        // });

        // allowed_outputs.forEach((output) => {
        //     // debug(`OUTPUT KEYS ${JSON.stringify(Object.keys(qeInfo['output_equivalent_identifiers']))}`);
        //     for (const o_key in qeInfo['output_equivalent_identifiers']) {
        //         qeInfo['output_equivalent_identifiers'][o_key].forEach((item) => {
        //             if (o_key == output && item && item['_dbIDs']) {   
        //                 debug(`Adding aliases of ${output}`);
        //                 output_e_ids = output_e_ids.concat(this._getIDs(item['_dbIDs']))
        //             }
        //         })
        //     }
        // });
        
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
        debug(`Hop filters ${JSON.stringify(equivalentIds)}`);
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
            `Filtered response from ${this.original_res.length} ` + 
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
        return;
    }


    /**
    * @private
    */
     _shouldFilter(qeInfo) {
        // debug(`EDGE BEING EXAMINED ${JSON.stringify(qeInfo)}`);
        // check object curie
        let object_curie = qeInfo['qEdge']['object']['curie'] || false;
        let subject_curie = qeInfo['qEdge']['subject']['curie'] || false;
        debug(`Hop goes from "${subject_curie}" to "${object_curie}"`);
        return (object_curie && subject_curie) ? true : false;
    }

    async applyFilter() {
        //this prevents reversed edges from being
        //processed twice since order does not matter
        let processed = new Set();
        await this.query_edges.forEach( async (queryEdge) => {
            if (!processed.has(queryEdge.qEdge.id)) {
                //examine and filter res based on each edge
                let should_filter = this._shouldFilter(queryEdge);
                debug(`Should Hop "${queryEdge.qEdge.id}" be filtered? ${should_filter}`);
                if (should_filter) {
                    processed.add(queryEdge.qEdge.id);
                    await this._filterRes(queryEdge);
                }
                // if any one edge is missing curies just return original res
                // means hop should not be restricted
                return this.original_res;
            }else{
                debug(`Hop "${queryEdge.qEdge.id}" already processed`);
            }
        });
        return this.filtered_res;
    }
};
