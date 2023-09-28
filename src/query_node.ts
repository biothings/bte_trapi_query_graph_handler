const _ = require('lodash');
const utils = require('./utils');
const biolink = require('./biolink');
const debug = require('debug')('bte:biothings-explorer-trapi:QNode');
const InvalidQueryGraphError = require('./exceptions/invalid_query_graph_error');

module.exports = class QNode {
  /**
   *
   * @param {object} info - Qnode info, e.g. ID, curie, category
   */
  constructor(info) {
    this.id = info.id;
    this.category = info.categories || 'NamedThing';
    this.expandedCategories = this.category;
    this.equivalentIDsUpdated = false;
    // mainIDs
    this.curie = info.ids;
    //is_set
    this.is_set = info.is_set;
    //mainID : its equivalent ids
    this.expanded_curie = info.expanded_curie !== undefined ? info.expanded_curie : {};
    this.entity_count = info.ids ? info.ids.length : 0;
    debug(`(1) Node "${this.id}" has (${this.entity_count}) entities at start.`);
    //when choosing a lower entity count a node with higher count
    // might be told to store its curies temporarily
    this.held_curie = info.held_curie !== undefined ? info.held_curie : [];
    this.held_expanded = info.held_expanded !== undefined ? info.held_expanded : {};
    //node constraints
    this.constraints = info.constraints;
    //list of edge ids that are connected to this node
    this.connected_to = info.connected_to !== undefined ? new Set(info.connected_to) : new Set();
    //object-ify array of initial curies
    if (info.expanded_curie === undefined) this.expandCurie();
    this.validateConstraints();
    this.expandCategories();
  }

  freeze() {
    return {
      category: this.category,
      connected_to: Array.from(this.connected_to),
      constraints: this.constraints,
      curie: this.curie,
      entity_count: this.entity_count,
      equivalentIDs: this.equivalentIDs,
      expanded_curie: this.expanded_curie,
      held_curie: this.held_curie,
      held_expanded: this.held_expanded,
      id: this.id,
      is_set: this.is_set,
    };
  }

  isSet() {
    //query node specified as set
    return this.is_set ? true : false;
  }

  validateConstraints() {
    const required = ['id', 'operator', 'value'];
    if (this.constraints && this.constraints.length) {
      this.constraints.forEach((constraint) => {
        let constraint_keys = Object.keys(constraint);
        if (_.intersection(constraint_keys, required).length < 3) {
          throw new InvalidQueryGraphError(`Invalid constraint specification must include (${required})`);
        }
      });
    }
  }

  expandCurie() {
    if (this.curie && this.curie.length) {
      this.curie.forEach((id) => {
        if (!Object.hasOwnProperty.call(id, this.expanded_curie)) {
          this.expanded_curie[id] = [id];
        }
      });
      debug(`(1) Node "${this.id}" expanded initial curie. ${JSON.stringify(this.expanded_curie)}`);
    }
  }

  updateConnection(qEdgeID) {
    this.connected_to.add(qEdgeID);
    debug(`"${this.id}" connected to "${[...this.connected_to]}"`);
  }

  getConnections() {
    return [...this.connected_to];
  }

  holdCurie() {
    //hold curie aside temp
    debug(`(8) Node "${this.id}" holding ${JSON.stringify(this.curie)} aside.`);
    this.held_curie = this.curie;
    this.held_expanded = this.expanded_curie;
    this.curie = undefined;
    this.expanded_curie = {};
  }

  updateCuries(curies) {
    // {originalID : [aliases]}
    if (!this.curie) {
      this.curie = [];
    }
    //bring back held curie
    if (this.held_curie.length) {
      debug(`(8) Node "${this.id}" restored curie.`);
      //restore
      this.curie = this.held_curie;
      this.expanded_curie = this.held_expanded;
      //reset holds
      this.held_curie = [];
      this.held_expanded = {};
    }
    if (!this.curie.length) {
      debug(`Node "${this.id}" saving (${Object.keys(curies).length}) curies...`);
      this.curie = Object.keys(curies);
      this.expanded_curie = curies;
    } else {
      debug(`Node "${this.id}" intersecting (${this.curie.length})/(${Object.keys(curies).length}) curies...`);
      // let intersection = this.intersectCuries(this.curie, curies);
      // this.curie = intersection;
      // debug(`Node "${this.id}" kept (${intersection.length}) curies...`);
      this.intersectWithExpandedCuries(curies);
    }
    this.entity_count = this.curie.length;
  }

  _combineCuriesIntoList(curies) {
    // curies {originalID : ['aliasID']}
    //combine all curies into single list for easy intersection
    let combined = new Set();
    for (const original in curies) {
      !Array.isArray(curies[original])
        ? combined.add(curies[original])
        : curies[original].forEach((curie) => {
            combined.add(curie);
          });
    }
    return [...combined];
  }

  intersectWithExpandedCuries(newCuries) {
    let keep = {};
    // If a new entity has any alias intersection with an existing entity, keep it
    Object.entries(newCuries).forEach(([newMainID, currentAliases]) => {
      const someIntersection = Object.entries(this.expanded_curie).some(([existingMainID, existingAliases]) => {
        return currentAliases.some((currentAlias) => existingAliases.some(existingAlias => currentAlias.toLowerCase() === existingAlias.toLowerCase()));
      });
      if (someIntersection) {
        if (!keep[newMainID]) keep[newMainID] = currentAliases;
      }
    });

    //save expanded curies (main + aliases)
    this.expanded_curie = keep;
    //save curies (main ids)
    this.curie = Object.keys(keep);
    debug(`Node "${this.id}" kept (${Object.keys(keep).length}) curies...`);
  }

  intersectCuries(curies, newCuries) {
    //curies is a list ['ID']
    // new curies {originalID : ['aliasID']}
    let all_new_curies = this._combineCuriesIntoList(newCuries);
    return _.intersection(curies, all_new_curies);
  }

  getID() {
    return this.id;
  }

  getCurie() {
    return this.curie;
  }

  getEquivalentIDs() {
    return this.equivalentIDs ?? {};
  }

  removeEquivalentID(id) {
    delete this.equivalentIDs[id];
  }

  getCategories() {
    if (this.equivalentIDsUpdated) this.expandCategories();
    return this.expandedCategories;
  }

  expandCategories() {
    this.equivalentIDsUpdated = false;
    if (this.hasEquivalentIDs() === false) {
      const categories = utils.toArray(this.category);
      let expanded_categories = [];
      categories.map((category) => {
        expanded_categories = [
          ...expanded_categories,
          ...(biolink.getDescendantClasses(utils.removeBioLinkPrefix(category)) || []),
        ];
      });
      this.expandedCategories = utils.getUnique(expanded_categories);
      return;
    }
    // let ancestors = new Set(
    //   utils
    //     .toArray(this.category)
    //     .map((category) => utils.removeBioLinkPrefix(category))
    //     .reduce((arr, category) => [...arr, ...biolink.getAncestorClasses(category)], [])
    //     .filter((category) => !utils.toArray(this.category).includes(`biolink:${category}`)),
    // );
    let categories = utils.toArray(this.category).map((category) => utils.removeBioLinkPrefix(category));
    Object.values(this.equivalentIDs).map((entity) => {
      categories = [...categories, ...entity.primaryTypes];
    });
    this.expandedCategories = utils.getUnique(
      utils.getUnique(categories).reduce((arr, category) => [...arr, ...(biolink.getDescendantClasses(category) || [])], []),
    );
    // .filter(category => !ancestors.has(category));
  }

  getEntities() {
    return Object.values(this.equivalentIDs).reduce((res, entity) => {
      return [...res, entity];
    }, []);
  }

  getPrimaryIDs() {
    return this.getEntities().map((entity) => entity.primaryID);
  }

  setEquivalentIDs(equivalentIDs) {
    this.equivalentIDs = equivalentIDs;
    this.equivalentIDsUpdated = true;
  }

  updateEquivalentIDs(equivalentIDs) {
    if (this.equivalentIDs === undefined) {
      this.equivalentIDs = equivalentIDs;
    } else {
      this.equivalentIDs = { ...this.equivalentIDs, ...equivalentIDs };
    }
    this.equivalentIDsUpdated = true;
  }

  hasInput() {
    return !(this.curie === undefined || this.curie === null);
  }

  hasEquivalentIDs() {
    return !(typeof this.equivalentIDs === 'undefined' || this.equivalentIDs === {});
  }

  getEntityCount() {
    return this.curie ? this.curie.length : 0;
  }
};
