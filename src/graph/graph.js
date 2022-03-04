const kg_edge = require('./kg_edge');
const kg_node = require('./kg_node');
const helper = require('../helper');
const debug = require('debug')('bte:biothings-explorer-trapi:Graph');

module.exports = class BTEGraph { // TODO rename to bteGraph? seems to only be used for such.
  constructor() {
    this.nodes = {};
    this.edges = {};
    this.paths = {};
    this.helper = new helper();
    this.subscribers = [];
  }

  update(queryRecords) {
    debug(`Updating BTE Graph now.`);
    const bteAttributes = ['name', 'label', 'id', 'api', 'provided_by', 'publications'];
    queryRecords.map((record) => {
      if (record) {
        const inputPrimaryCurie = this.helper._getInputCurie(record);
        const inputQNodeID = this.helper._getInputQueryNodeID(record);
        const inputBTEGraphID = inputPrimaryCurie + '-' + inputQNodeID;
        const outputPrimaryCurie = this.helper._getOutputCurie(record);
        const outputQNodeID = this.helper._getOutputQueryNodeID(record);
        const outputBTEGraphID = outputPrimaryCurie + '-' + outputQNodeID;
        const recordEdgeHash = this.helper._getRecordHash(record);
        if (!(outputBTEGraphID in this.nodes)) {
          this.nodes[outputBTEGraphID] = new kg_node(outputBTEGraphID, {
            primaryCurie: outputPrimaryCurie,
            qNodeID: outputQNodeID,
            equivalentCuries: this.helper._getOutputEquivalentIds(record),
            names: this.helper._getOutputNames(record),
            label: this.helper._getOutputLabel(record),
            category: this.helper._getOutputCategory(record),
            nodeAttributes: this.helper._getOutputAttributes(record),
          });
        }
        if (!(inputBTEGraphID in this.nodes)) {
          this.nodes[inputBTEGraphID] = new kg_node(inputBTEGraphID, {
            primaryCurie: inputPrimaryCurie,
            qNodeID: inputQNodeID,
            equivalentCuries: this.helper._getInputEquivalentCuries(record),
            names: this.helper._getInputNames(record),
            label: this.helper._getInputLabel(record),
            category: this.helper._getInputCategory(record),
            nodeAttributes: this.helper._getInputAttributes(record),
          });
        }
        this.nodes[outputBTEGraphID].addSourceNode(inputBTEGraphID);
        this.nodes[outputBTEGraphID].addSourceQNodeID(inputQNodeID);
        this.nodes[inputBTEGraphID].addTargetNode(outputBTEGraphID);
        this.nodes[inputBTEGraphID].addTargetQNodeID(outputQNodeID);
        if (!(recordEdgeHash in this.edges)) {
          this.edges[recordEdgeHash] = new kg_edge(recordEdgeHash, {
            predicate: this.helper._getPredicate(record),
            subject: inputPrimaryCurie,
            object: outputPrimaryCurie,
          });
        }
        this.edges[recordEdgeHash].addAPI(this.helper._getAPI(record));
        this.edges[recordEdgeHash].addInforesCurie(this.helper._getInforesCurie(record));
        this.edges[recordEdgeHash].addSource(this.helper._getSource(record));
        this.edges[recordEdgeHash].addPublication(this.helper._getPublication(record));
        Object.keys(record)
          .filter((k) => !(bteAttributes.includes(k) || k.startsWith('$')))
          .map((item) => {
            this.edges[recordEdgeHash].addAdditionalAttributes(item, record[item]);
          });
      }
    });
  }

  /**
   * Register subscribers
   * @param {object} subscriber
   */
  subscribe(subscriber) {
    this.subscribers.push(subscriber);
  }

  /**
   * Unsubscribe a listener
   * @param {object} subscriber
   */
  unsubscribe(subscriber) {
    this.subscribers = this.subscribers.filter((fn) => {
      if (fn != subscriber) return fn;
    });
  }

  /**
   * Nofity all listeners
   */
  notify() {
    this.subscribers.map((subscriber) => {
      subscriber.update({
        nodes: this.nodes,
        edges: this.edges,
      });
    });
  }
};
