const kg_edge = require('./kg_edge');
const kg_node = require('./kg_node');
const helper = require('../helper');
const debug = require('debug')('bte:biothings-explorer-trapi:Graph');

module.exports = class BTEGraph {
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
        const inputBTENodeID = inputPrimaryCurie + '-' + inputQNodeID;
        const outputPrimaryCurie = this.helper._getOutputCurie(record);
        const outputQNodeID = this.helper._getOutputQueryNodeID(record);
        const outputBTENodeID = outputPrimaryCurie + '-' + outputQNodeID;
        const recordHash = this.helper._getRecordHash(record);
        if (!(outputBTENodeID in this.nodes)) {
          this.nodes[outputBTENodeID] = new kg_node(outputBTENodeID, {
            primaryCurie: outputPrimaryCurie,
            qNodeID: outputQNodeID,
            equivalentCuries: this.helper._getOutputEquivalentIds(record),
            names: this.helper._getOutputNames(record),
            label: this.helper._getOutputLabel(record),
            category: this.helper._getOutputCategory(record),
            nodeAttributes: this.helper._getOutputAttributes(record),
          });
        }
        if (!(inputBTENodeID in this.nodes)) {
          this.nodes[inputBTENodeID] = new kg_node(inputBTENodeID, {
            primaryCurie: inputPrimaryCurie,
            qNodeID: inputQNodeID,
            equivalentCuries: this.helper._getInputEquivalentCuries(record),
            names: this.helper._getInputNames(record),
            label: this.helper._getInputLabel(record),
            category: this.helper._getInputCategory(record),
            nodeAttributes: this.helper._getInputAttributes(record),
          });
        }
        this.nodes[outputBTENodeID].addSourceNode(inputBTENodeID);
        this.nodes[outputBTENodeID].addSourceQNodeID(inputQNodeID);
        this.nodes[inputBTENodeID].addTargetNode(outputBTENodeID);
        this.nodes[inputBTENodeID].addTargetQNodeID(outputQNodeID);
        if (!(recordHash in this.edges)) {
          this.edges[recordHash] = new kg_edge(recordHash, {
            predicate: this.helper._getPredicate(record),
            subject: inputPrimaryCurie,
            object: outputPrimaryCurie,
          });
        }
        this.edges[recordHash].addAPI(this.helper._getAPI(record));
        this.edges[recordHash].addInforesCurie(this.helper._getInforesCurie(record));
        this.edges[recordHash].addSource(this.helper._getSource(record));
        this.edges[recordHash].addPublication(this.helper._getPublication(record));
        Object.keys(record)
          .filter((k) => !(bteAttributes.includes(k) || k.startsWith('$')))
          .map((item) => {
            this.edges[recordHash].addAdditionalAttributes(item, record[item]);
          });
      }
    });
  }

  prune(results) {
    debug('pruning BTEGraph nodes/edges...');
    const resultsBoundNodes = new Set();
    const resultsBoundEdges = new Set();

    results.forEach((result) => {
      Object.entries(result.node_bindings).forEach(([node, bindings]) => {
        bindings.forEach((binding) => resultsBoundNodes.add(`${binding.id}-${node}`));
      });
      Object.entries(result.edge_bindings).forEach(([edge, bindings]) => {
        bindings.forEach((binding) => resultsBoundEdges.add(binding.id));
      });
    });

    const nodesToDelete = Object.keys(this.nodes)
      .filter((bteNodeID) => !resultsBoundNodes.has(bteNodeID));
    nodesToDelete.forEach((unusedBTENodeID) => delete this.nodes[unusedBTENodeID]);
    const edgesToDelete = Object.keys(this.edges)
      .filter((recordHash) => !resultsBoundEdges.has(recordHash));
    edgesToDelete.forEach((unusedRecordHash) => delete this.edges[unusedRecordHash]);
    debug(`pruned ${nodesToDelete.length} nodes and ${edgesToDelete.length} edges from BTEGraph.`);
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
