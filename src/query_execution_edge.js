const helper = require('./helper');
const debug = require('debug')('biothings-explorer-trapi:QExeEdge');
const utils = require('./utils');
const reverse = require('./biolink');

module.exports = class QExeEdge {
  /**
   *
   * @param {string} id - QEdge ID
   * @param {object} info - QEdge info, e.g. subject, object, predicate
   */
  constructor(qEdge, reverse = false, prev_edge = undefined) {
    this.qEdge = qEdge;
    this.reverse = reverse;
    this.prev_edge = prev_edge;
    this.input_equivalent_identifiers = {};
    this.output_equivalent_identifiers = {};
  }

  getID() {
    return this.qEdge.getID();
  }

  getHashedEdgeRepresentation() {
    const toBeHashed =
      this.getSubject().getCategories() + this.getPredicate() + this.getObject().getCategories() + this.getInputCurie();
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
    if (this.reverse) {
      return this.qEdge.object;
    }
    return this.qEdge.subject;
  }

  getObject() {
    if (this.reverse) {
      return this.qEdge.subject;
    }
    return this.qEdge.object;
  }

  isReversed() {
    return this.reverse;
  }

  getInputCurie() {
    let curie = this.qEdge.subject.getCurie() || this.qEdge.object.getCurie();
    if (Array.isArray(curie)) {
      return curie;
    }
    return [curie];
  }

  getInputNode() {
    return this.reverse ? this.qEdge.object : this.qEdge.subject;
  }

  getOutputNode() {
    return this.reverse ? this.qEdge.subject : this.qEdge.object;
  }

  hasInputResolved() {
    return !(Object.keys(this.input_equivalent_identifiers).length === 0);
  }

  hasInput() {
    if (this.reverse) {
      return this.qEdge.object.hasInput();
    }
    return this.qEdge.subject.hasInput();
  }
};
