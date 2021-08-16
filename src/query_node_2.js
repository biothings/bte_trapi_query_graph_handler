const _ = require('lodash');
const utils = require('./utils');
const biolink = require('./biolink');
const debug = require('debug')('bte:biothings-explorer-trapi:NewQNode');

module.exports = class QNode {
    /**
     *
     * @param {string} id - QNode ID
     * @param {object} info - Qnode info, e.g. curie, category
     */
    constructor(id, info) {
        this.id = id;
        this.category = info.categories || 'NamedThing';
        this.curie = info.ids;
        this.entity_count = info.ids ? info.ids.length : 0;
        debug(`(1) Node "${this.id}" has (${this.entity_count}) entities at start.`);
        //when choosing a lower entity count a node with higher count
        // might be told to store its curies temporarily
        this.held_curie = [];
        //list of edge ids that are connected to this node
        this.connected_to = new Set();
    }

    updateConnection(edge_id) {
        this.connected_to.add(edge_id);
        debug(`"${this.id}" connected to "${[...this.connected_to]}"`);
    }

    getConnections() {
        return [...this.connected_to];
    }

    holdCurie() {
        //hold curie aside temp
        debug(`(8) Node "${this.id}" holding ${JSON.stringify(this.curie)} aside.`);
        this.held_curie = this.curie;
        this.curie = undefined;
    }

    updateCuries(curies) {
        // {originalID : [aliases]}
        if (!this.curie) {
            this.curie = [];
        }
        //bring back held curie
        if (this.held_curie.length) {
            debug(`(8) Node "${this.id}" restored curie.`);
            this.curie = this.held_curie;
            this.held_curie = [];
        }
        if (!this.curie.length) {
            debug(`Node "${this.id}" saving (${Object.keys(curies).length}) curies...`);
            this.curie = Object.keys(curies);
        }else{
            debug(`Node "${this.id}" intersecting (${this.curie.length})/(${Object.keys(curies).length}) curies...`);
            // debug(`Intersecting (${JSON.stringify(this.curie)})/(${JSON.stringify(curies)})`);
            let intersection = this.intersectCuries(this.curie, curies);
            debug(`Node "${this.id}" kept (${intersection.length}) curies...`);
            //keep outcome of intersection to make filtering strict even if no results
            this.curie = intersection;
        }
        this.entity_count = this.curie.length;
    }

    _combineCuriesIntoList(curies) {
        // curies {originalID : ['aliasID']}
        //combine all curies into single list for easy intersection
        let combined  = new Set();
        for (const original in curies) {
            !Array.isArray(curies[original]) ?
            combined.add(curies[original]) :
            curies[original].forEach((curie) => {
                combined.add(curie);
            });
        }
        return [...combined];
    }

    intersectCuries(curies, newCuries) {
        // let keep = new Set();
        //curies is a list ['ID']
        // new curies {originalID : ['aliasID']}
        let all_new_curies = this._combineCuriesIntoList(newCuries);
        return _.intersection(curies, all_new_curies );
    }

    getID() {
        return this.id;
    }

    getCurie() {
        return this.curie;
    }

    getEquivalentIDs() {
        return this.equivalentIDs;
    }

    getCategories() {
        if (this.hasEquivalentIDs() === false) {
        const categories = utils.toArray(this.category);
        let expanded_categories = [];
        categories.map((category) => {
            expanded_categories = [
            ...expanded_categories,
            ...biolink.getDescendantClasses(utils.removeBioLinkPrefix(category)),
            ];
        });
        return utils.getUnique(expanded_categories);
        }
        let categories = [];
        Object.values(this.equivalentIDs).map((entities) => {
        entities.map((entity) => {
            categories = [...categories, ...entity.semanticTypes];
        });
        });
        return utils.getUnique(categories);
    }

    getEntities() {
        return Object.values(this.equivalentIDs).reduce((res, entities) => {
        return [...res, ...entities];
        }, []);
    }

    getPrimaryIDs() {
        return this.getEntities().map((entity) => entity.primaryID);
    }

    setEquivalentIDs(equivalentIDs) {
        this.equivalentIDs = equivalentIDs;
    }

    updateEquivalentIDs(equivalentIDs) {
        if (this.equivalentIDs === undefined) {
        this.equivalentIDs = equivalentIDs;
        } else {
        this.equivalentIDs = { ...this.equivalentIDs, ...equivalentIDs };
        }
    }

    hasInput() {
        return !(typeof this.curie === 'undefined');
    }

    hasEquivalentIDs() {
        return !(typeof this.equivalentIDs === 'undefined');
    }
};