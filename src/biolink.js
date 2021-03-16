const bl = require('biolink-model');
var path = require('path');
const debug = require('debug')('biothings-explorer-trapi:EdgeReverse');

class BioLinkModel {
  constructor() {
    if (!BioLinkModel.instance) {
      debug('BioLink-model class is initiated.');
      let biolink_file = path.resolve(__dirname, './biolink.json');
      this.biolink = new bl.BioLink();
      this.biolink.loadSync(biolink_file);
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

  getDescendantClasses(className) {
    if (className in this.biolink.classTree.objects) {
      const descendants = this.biolink.classTree.getDescendants(className).map((entity) => entity.name);
      return [...descendants, ...[className]];
    }
    return className;
  }
}

const BioLinkModelInstance = new BioLinkModel();
Object.freeze(BioLinkModelInstance);

module.exports = BioLinkModelInstance;
