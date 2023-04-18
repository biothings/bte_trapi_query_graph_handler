const kg_edge = require('./kg_edge');
const kg_node = require('./kg_node');
const debug = require('debug')('bte:biothings-explorer-trapi:Graph');
const LogEntry = require('../log_entry');

module.exports = class BTEGraph {
  constructor() {
    this.nodes = {};
    this.edges = {};
    this.paths = {};
    this.subscribers = [];
  }

  update(queryRecords) {
    debug(`Updating BTE Graph now.`);
    const bteAttributes = ['name', 'label', 'id', 'api', 'provided_by', 'publications'];
    queryRecords.map((record) => {
      if (record) {
        const inputPrimaryCurie = record.subject.curie;
        const inputQNodeID = record.subject.qNodeID;
        const inputBTENodeID = inputPrimaryCurie + '-' + inputQNodeID;
        const outputPrimaryCurie = record.object.curie;
        const outputQNodeID = record.object.qNodeID;
        const outputBTENodeID = outputPrimaryCurie + '-' + outputQNodeID;
        const recordHash = record.recordHash;
        if (!(outputBTENodeID in this.nodes)) {
          this.nodes[outputBTENodeID] = new kg_node(outputBTENodeID, {
            primaryCurie: outputPrimaryCurie,
            qNodeID: outputQNodeID,
            equivalentCuries: record.object.equivalentCuries,
            names: record.object.names,
            label: record.object.label,
            category: [record.object.semanticType[0]],
            nodeAttributes: record.object.attributes,
          });
        }
        if (!(inputBTENodeID in this.nodes)) {
          this.nodes[inputBTENodeID] = new kg_node(inputBTENodeID, {
            primaryCurie: inputPrimaryCurie,
            qNodeID: inputQNodeID,
            equivalentCuries: record.subject.equivalentCuries,
            names: record.subject.names,
            label: record.subject.label,
            category: [record.subject.semanticType[0]],
            nodeAttributes: record.subject.attributes,
          });
        }
        this.nodes[outputBTENodeID].addSourceNode(inputBTENodeID);
        this.nodes[outputBTENodeID].addSourceQNodeID(inputQNodeID);
        this.nodes[inputBTENodeID].addTargetNode(outputBTENodeID);
        this.nodes[inputBTENodeID].addTargetQNodeID(outputQNodeID);
        if (!(recordHash in this.edges)) {
          this.edges[recordHash] = new kg_edge(recordHash, {
            predicate: record.predicate,
            subject: inputPrimaryCurie,
            object: outputPrimaryCurie,
          });
        }
        this.edges[recordHash].addAPI(record.api);
        this.edges[recordHash].addApiID(record.association.smartapi.id)
        this.edges[recordHash].addInforesCurie(record.apiInforesCurie);
        this.edges[recordHash].addSource(record.metaEdgeSource);
        this.edges[recordHash].addPublication(record.publications);
        Object.keys(record.mappedResponse)
          .filter((k) => !(bteAttributes.includes(k) || k.startsWith('$')))
          .map((item) => {
            this.edges[recordHash].addAdditionalAttributes(item, record.mappedResponse[item]);
          });
        Object.entries(record.qualifiers).forEach(([qualifierType, qualifier]) => {
          this.edges[recordHash].addQualifier(qualifierType, qualifier);
        })
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

  checkPrimaryKnowledgeSources(knowledgeGraph) {
    let logs = []
    Object.keys(knowledgeGraph.edges).map((edge) => {
      const has_primary_knowledge_source = knowledgeGraph.edges[edge].attributes.some(e =>
        e.attribute_type_id === 'biolink:primary_knowledge_source' &&
        ( e.value?.length || (!Array.isArray(e.value) && e.value))
      );
      if (!has_primary_knowledge_source) {
        const logMsg = `Edge ${edge} (APIs: ${Array.from(this.edges[edge].apis).join(', ')}) is missing a primary knowledge source`
        debug(logMsg)
        logs.push(new LogEntry(
          'WARNING',
          null,
          logMsg,
        ).getLog())
      }
    });
    return logs
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
