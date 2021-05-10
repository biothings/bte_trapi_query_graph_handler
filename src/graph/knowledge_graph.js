const GraphHelper = require('../helper');
const debug = require('debug')('biothings-explorer-trapi:KnowledgeGraph');
const helper = new GraphHelper();

module.exports = class KnowledgeGraph {
  constructor() {
    this.nodes = {};
    this.edges = {};
    this.kg = {
      nodes: this.nodes,
      edges: this.edges,
    };
  }

  getNodes() {
    return this.nodes;
  }

  getEdges() {
    return this.edges;
  }

  _createNode(kgNode) {
    const res = {
      category: 'biolink:' + kgNode._semanticType,
      name: kgNode._label,
      attributes: [
        {
          name: 'equivalent_identifiers',
          value: kgNode._curies,
          type: 'biolink:id',
        },
        {
          name: 'num_source_nodes',
          value: kgNode._sourceNodes.size,
          type: 'bts:num_source_nodes',
        },
        {
          name: 'num_target_nodes',
          value: kgNode._targetNodes.size,
          type: 'bts:num_target_nodes',
        },
        {
          name: 'source_qg_nodes',
          value: Array.from(kgNode._sourceQGNodes),
          type: 'bts:source_qg_nodes',
        },
        {
          name: 'target_qg_nodes',
          value: Array.from(kgNode._targetQGNodes),
          type: 'bts:target_qg_nodes',
        },
      ],
    };
    for (const key in kgNode._nodeAttributes) {
      res.attributes.push({
        name: key,
        value: kgNode._nodeAttributes[key],
        type: 'bts:' + key,
      });
    }
    return res;
  }

  _createAttributes(kgEdge) {
    const attributes = [
      {
        name: 'provided_by',
        value: Array.from(kgEdge.sources),
        type: 'biolink:provided_by',
      },
      {
        name: 'api',
        value: Array.from(kgEdge.apis),
        type: 'bts:api',
      },
      {
        name: 'publications',
        value: Array.from(kgEdge.publications),
        type: 'biolink:publication',
      },
    ];
    for (const key in kgEdge.attributes) {
      attributes.push({
        name: key,
        value: kgEdge.attributes[key],
        type: 'bts:' + key,
      });
    }
    return attributes;
  }

  _createEdge(kgEdge) {
    return {
      predicate: kgEdge.predicate,
      subject: kgEdge.subject,
      object: kgEdge.object,
      attributes: this._createAttributes(kgEdge),
    };
  }

  update(bteGraph) {
    Object.keys(bteGraph.nodes).map((node) => {
      this.nodes[bteGraph.nodes[node]._primaryID] = this._createNode(bteGraph.nodes[node]);
    });
    Object.keys(bteGraph.edges).map((edge) => {
      this.edges[edge] = this._createEdge(bteGraph.edges[edge]);
    });
    this.kg = {
      nodes: this.nodes,
      edges: this.edges,
    };
  }
};
