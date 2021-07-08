const id_resolver = require('biomedical_id_resolver');
const debug = require('debug')('bte:biothings-explorer-trapi:KG_Filter');
const LogEntry = require('./log_entry');

module.exports = class KGFilter {
    constructor(unfiltered = {}, query = {}) {
        this.nodes = {};
        this.edges = {};
        this.query = query;
        this.kg = unfiltered;
        // we want to only return nodes and 
        //edges with these ids:
        this.filter_ids = [];
        this.logs = [];
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
        let r_key = Array.isArray(item['categories']) ?
        item['categories'][0].split(":")[1] :
        item['categories'].split(":")[1];
        let r_value = item['ids'];
        resolveThis[r_key] = r_value;
        return resolveThis;
    }

    /**
    * @private
    */
    _getIDs(res) {
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

    /**
    * @private
    */
    async _createFiltersFromNodes(){
        //look in original query for node ids
        for (var key in this.query.nodes) {
            try {
                let resolvableItem = this._createResolvableItem(this.query.nodes[key]);
                debug(`KGF getting equivalent IDs of ${JSON.stringify(resolvableItem)}`);
                //add results to lis tof filters
                let res = await this._getEquivalentIDs(resolvableItem);
                let ids = this._getIDs(res);
                this.filter_ids = this.filter_ids.concat(ids);
            } catch (error) {
                debug(`KGF failed: ${this.query.nodes[key]['ids']} because ${error}`);
            }
        }
        debug(`KG filter includes these ids: ${JSON.stringify(this.filter_ids)}`);
        this.logs.push(
            new LogEntry(
                'DEBUG', 
                null, 
                `Knowledge Graph node and edge relevancy filter will include ` +
                `these ids: ${JSON.stringify(this.filter_ids)}`
                ).getLog(),
        );
    }

    /**
    * @private
    */
    _filterNodes() {
        let kept = 0;
        let removed = 0;
        for (const node_key in this.kg.nodes) {
            //check node key is part of filters if so keep it
            if (this.filter_ids.includes(node_key)) {
                this.nodes[node_key] = this.kg.nodes[node_key];
                kept++;
            }else{
                removed++;
            }
        }
        debug(`nodes kept ${kept}, nodes removed ${removed}`);
        this.logs.push(
            new LogEntry(
                'DEBUG', 
                null, 
                `Successfully applied post-query NODE filter ` +
                `based on relevancy: ` +
                `kept ${kept}, removed ${removed}`
                ).getLog(),
        );
    }

    /**
    * @private
    */
    _filterEdges() {
        let kept = 0;
        let removed = 0;
        for (const edge_key in this.kg.edges) {
            //check source and target of each edge
            //"CHEBI:41423-biolink:metabolic_processing_affected_by-NCBIGene:1576"
            //if nodes found in filters keep it
            //TODO if the first id has an '-' this could cause an issue
            let parts = edge_key.split("-", 3)
            if (parts.length === 3) {
                let source = parts[0];
                let target = parts[2];
                // debug(`S ${source}, T ${target}`);
                if (
                    this.filter_ids.includes(source) &&
                    this.filter_ids.includes(target)
                    ) {
                    this.edges[edge_key] = this.kg.edges[edge_key];
                    kept++;
                }else{
                    removed++;
                }
            }
        }
        debug(`edges kept ${kept}, edges removed ${removed}`);
        this.logs.push(
            new LogEntry(
                'DEBUG', 
                null, 
                `Successfully applied post-query EDGE filter ` +
                `based on relevancy: ` +
                `kept ${kept}, removed ${removed}`
                ).getLog(),
        );
    }

    /**
    * @private
    */
     _shouldFilter() {
        //look at each node to see if they specify
        //an id type in particular if only 1 has it
        //skip else collect ids and filter
        let nodes_present = Object.keys(this.query.nodes).length;
        let nodes_with_ids = 0;
        for (var node_key in this.query.nodes) {
            if (Object.hasOwnProperty.call(this.query.nodes[node_key], 'ids'))  {
                nodes_with_ids++;
            }
        }
        return nodes_with_ids === nodes_present ? true : false;
    }

    async applyFilter() {
        if (!this._shouldFilter()) {
            //return unfiltered
            this.logs.push(
                new LogEntry(
                    'DEBUG', 
                    null, 
                    `Knowledge Graph node and edge relevancy skipped ` +
                    `because specific IDs were not specified.`
                    ).getLog(),
            );
            return this.kg;
        }
        //get aliases of node ids
        await this._createFiltersFromNodes();
        //filter and include relevant ids only
        this._filterNodes();
        this._filterEdges();
        let filtered = {
            nodes: this.nodes,
            edges: this.edges
        }
        return filtered;
    }
};
