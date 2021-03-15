const bl = require("biolink-model")
var path = require('path');
const debug = require('debug')('biothings-explorer-trapi:EdgeReverse');

class EdgeReverse {
    constructor() {
        if (!EdgeReverse.instance) {
            debug('Edge Reverse class is initiated.');
            let biolink_file = path.resolve(__dirname, './biolink.json');
            this.biolink = new bl.BioLink();
            this.biolink.loadSync(biolink_file);
        }

        return EdgeReverse.instance;
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
}

const EdgeReverseInstance = new EdgeReverse();
Object.freeze(EdgeReverseInstance);

module.exports = EdgeReverseInstance;
