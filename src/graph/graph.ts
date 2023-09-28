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
    const bteAttributes = ['name', 'label', 'id', 'api', 'provided_by', 'publications', 'trapi_sources'];
    queryRecords.map((record) => {
      if (record) {
        const inputPrimaryCurie = record.subject.curie;
        const inputQNodeID = record.subject.qNodeID;
        const inputBTENodeID = inputPrimaryCurie;
        // const inputBTENodeID = inputPrimaryCurie + '-' + inputQNodeID;
        const outputPrimaryCurie = record.object.curie;
        const outputQNodeID = record.object.qNodeID;
        // const outputBTENodeID = outputPrimaryCurie + '-' + outputQNodeID;
        const outputBTENodeID = outputPrimaryCurie;
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
        else if (this.nodes[outputBTENodeID]._label === undefined || this.nodes[outputBTENodeID]._label === this.nodes[outputBTENodeID]._primaryCurie) {
            this.nodes[outputBTENodeID]._label = record.object.label;
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
        else if (this.nodes[inputBTENodeID]._label === undefined || this.nodes[inputBTENodeID]._label === this.nodes[inputBTENodeID]._primaryCurie) {
            this.nodes[inputBTENodeID]._label = record.subject.label;
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
        this.edges[recordHash].addInforesCurie(record.apiInforesCurie);
        this.edges[recordHash].addPublication(record.publications);
        Object.keys(record.mappedResponse)
          .filter((k) => !(bteAttributes.includes(k) || k.startsWith('$')))
          .map((item) => {
            this.edges[recordHash].addAdditionalAttributes(item, record.mappedResponse[item]);
          });
        this.edges[recordHash].addSource(record.provenanceChain);
        Object.entries(record.qualifiers).forEach(([qualifierType, qualifier]) => {
          this.edges[recordHash].addQualifier(qualifierType, qualifier);
        });
      }
    });
  }

  prune(results, auxGraphs) {
    debug('pruning BTEGraph nodes/edges...');
    const edgeBoundNodes = new Set();
    const resultsBoundEdges = new Set();

    // Handle nodes and edges bound to results directly
    results.forEach((result) => {
      Object.entries(result.analyses[0].edge_bindings).forEach(([edge, bindings]) => {
        bindings.forEach((binding) => resultsBoundEdges.add(binding.id));
      });
    });

    // Handle edges bound via auxiliary graphs
    // This will iterate over new edges as they're added
    resultsBoundEdges.forEach((edgeID) => {
      edgeBoundNodes.add(this.edges[edgeID].subject);
      edgeBoundNodes.add(this.edges[edgeID].object);
      const supportGraphs = [...(this.edges[edgeID].attributes['biolink:support_graphs'] ?? [])];
      supportGraphs.forEach((auxGraphID) => {
        auxGraphs[auxGraphID].edges.forEach((auxGraphEdgeID) => {
          edgeBoundNodes.add(this.edges[auxGraphEdgeID].subject);
          edgeBoundNodes.add(this.edges[auxGraphEdgeID].object);
          resultsBoundEdges.add(auxGraphEdgeID);
        });
      });
    });

    const nodesToDelete = Object.keys(this.nodes).filter((bteNodeID) => !edgeBoundNodes.has(bteNodeID));
    nodesToDelete.forEach((unusedBTENodeID) => delete this.nodes[unusedBTENodeID]);
    const edgesToDelete = Object.keys(this.edges).filter((recordHash) => !resultsBoundEdges.has(recordHash));
    edgesToDelete.forEach((unusedRecordHash) => delete this.edges[unusedRecordHash]);
    debug(`pruned ${nodesToDelete.length} nodes and ${edgesToDelete.length} edges from BTEGraph.`);
  }

  checkPrimaryKnowledgeSources(knowledgeGraph) {
    let logs = [];
    Object.entries(knowledgeGraph.edges).map(([edgeID, edge]) => {
      const has_primary_knowledge_source = edge.sources.some(
        (source) => source.resource_role === 'primary_knowledge_source' && source.resource_id,
      );
      if (!has_primary_knowledge_source) {
        const logMsg = `Edge ${edgeID} (APIs: ${Array.from(this.edges[edgeID].apis).join(
          ', ',
        )}) is missing a primary knowledge source`;
        debug(logMsg);
        logs.push(new LogEntry('WARNING', null, logMsg).getLog());
      }
    });
    return logs;
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
