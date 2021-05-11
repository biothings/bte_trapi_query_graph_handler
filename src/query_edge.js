const helper = require('./helper');
const debug = require('debug')('biothings-explorer-trapi:QEdge');
const utils = require('./utils');
const reverse = require('./biolink');

module.exports = class QEdge {
  /**
   *
   * @param {string} id - QEdge ID
   * @param {object} info - QEdge info, e.g. subject, object, predicate
   */
  constructor(id, info) {
    this.id = id;
    this.predicate = info.predicates;
    this.subject = info.subject;
    this.object = info.object;
  }

  getID() {
    return this.id;
  }

  getHashedEdgeRepresentation() {
    const toBeHashed =
      this.subject.getCategories() + this.predicate + this.object.getCategories() + this.getInputCurie();
    return new helper()._generateHash(toBeHashed);
  }

  expandPredicates(predicates) {
    const reducer = (acc, cur) => [...acc, ...reverse.getDescendantPredicates(cur)];
    return Array.from(new Set(predicates.reduce(reducer, [])));
  }

  getPredicate() {
    if (this.predicate === undefined) {
      return undefined;
    }
    const predicates = utils.toArray(this.predicate).map((item) => utils.removeBioLinkPrefix(item));
    const expandedPredicates = this.expandPredicates(predicates);
    debug(`Expanded edges: ${expandedPredicates}`);
    return expandedPredicates
      .map((predicate) => {
        return this.isReversed() === true ? reverse.reverse(predicate) : predicate;
      })
      .filter((item) => !(typeof item === 'undefined'));
  }

  getSubject() {
    if (this.isReversed()) {
      return this.object;
    }
    return this.subject;
  }

  getObject() {
    if (this.isReversed()) {
      return this.subject;
    }
    return this.object;
  }

  isReversed() {
    return this.subject.getCurie() === undefined && this.object.getCurie() !== undefined;
  }

  getInputCurie() {
    let curie = this.subject.getCurie() || this.object.getCurie();
    if (Array.isArray(curie)) {
      return curie;
    }
    return [curie];
  }

  getInputNode() {
    return this.isReversed() ? this.object : this.subject;
  }

  getOutputNode() {
    return this.isReversed() ? this.subject : this.object;
  }

  hasInputResolved() {
    if (this.isReversed()) {
      return this.object.hasEquivalentIDs();
    }
    return this.subject.hasEquivalentIDs();
  }

  hasInput() {
    if (this.isReversed()) {
      return this.object.hasInput();
    }
    return this.subject.hasInput();
  }
};
