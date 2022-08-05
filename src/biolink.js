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

  isCanonical(predicate) {
    if (typeof predicate === 'string') {
      if (predicate in this.biolink.slotTree.objects) {
        console.log("slttree")
        console.log(this.biolink.slotTree.objects[predicate])
        if (this.biolink.slotTree.objects[predicate].canonical_predicate !== true) {
          return false;
        }
      }
    }
    return true;
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
}

const BioLinkModelInstance = new BioLinkModel();
Object.freeze(BioLinkModelInstance);

module.exports = BioLinkModelInstance;
