const bl = require('biolink-model');
var path = require('path');
const debug = require('debug')('bte:biothings-explorer-trapi:EdgeReverse');

class BioLinkModel {
  constructor() {
    if (!BioLinkModel.instance) {
      debug('BioLink-model class is initiated.');
      this.biolink = new bl.BioLink();
      this.biolink.loadSync();
    }

    return BioLinkModel.instance;
  }

  reverse(predicate) {
    if (typeof predicate === 'string') {
      if (predicate in this.biolink.slotTree.objects) {
        if (this.biolink.slotTree.objects[predicate].symmetric === true) {
          return predicate;
        }
        return this.biolink.slotTree.objects[predicate].inverse;
      }
    }

    return undefined;
  }

  getAncestorClasses(className) {
    if (className in this.biolink.classTree.objects) {
      const ancestors = this.biolink.classTree.getAncestors(className).map((entity) => entity.name);
      return [...ancestors, ...[className]];
    }
    return className;
  }

  getAncestorPredicates(predicate) {
    if (predicate in this.biolink.slotTree.objects) {
      const ancestors = this.biolink.slotTree.getAncestors(predicate).map((entity) => entity.name);
      return [...ancestors, ...[predicate]];
    }
    return predicate;
  }

  getDescendantClasses(className) {
    if (className in this.biolink.classTree.objects) {
      const descendants = this.biolink.classTree.getDescendants(className).map((entity) => entity.name);
      return [...descendants, ...[className]];
    }
    return className;
  }

  getDescendantPredicates(predicate) {
    if (predicate in this.biolink.slotTree.objects) {
      const descendants = this.biolink.slotTree.getDescendants(predicate).map((entity) => entity.name);
      return [...descendants, ...[predicate]];
    }
    return [predicate];
  }

  getDescendantQualifiers(qualifier) {
    try {
        const descendants = this.biolink.enumTree.getDescendants(qualifier).map((entity) => entity.name);
        return [...descendants, qualifier]
    } catch (e) {
        console.log("qual error", e)
        return [qualifier]
    }
  }
}

const BioLinkModelInstance = new BioLinkModel();
Object.freeze(BioLinkModelInstance);

module.exports = BioLinkModelInstance;
