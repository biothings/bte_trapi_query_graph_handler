const _ = require('lodash');
const utils = require('./utils');
const biolink = require('./biolink');

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
