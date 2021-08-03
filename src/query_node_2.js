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
        //when choosing a lower entity count
        //a node with higher count might be told to store its
        //curies temporarily
        this.held_curie = [];
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
        if (this.category.toString().includes('NamedThing')) {
            //if this nodes category is a broad that that
            //may include more than one type just collect ids and 
            // no not intersect
            debug(`Saving (${Object.keys(curies).length}) curies to broad type node.`);
            this.curie = this.curie.concat(Object.keys(curies));
        }else{
            //else save/intersect as usual
            if (!this.curie.length) {
                debug(`Saving (${Object.keys(curies).length}) curies...`);
                this.curie = Object.keys(curies);
            }else{
                debug(`Intersecting (${this.curie.length})/(${Object.keys(curies).length})  curies...`);
                let intersection = this.intersectCuries(this.curie, curies);
                //if intersection resulted in 0 keep original curie
                this.curie = intersection.length ? intersection : this.curie;
            }
        }
        this.entity_count = this.curie.length;
    }

    intersectCuries(curies, newCuries) {
        let keep = new Set();
        //curies is a list
        // new curies {originalID : [aliases]}
        //goal is to intersect both and only keep the original ID
        //of items that exist in both
        for (const original in newCuries) {
            newCuries[original].forEach((alias) => {
                if (curies.includes(alias) || curies.includes(original)) {
                    keep.add(original);
                }
            });
        }
        return [...keep];
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