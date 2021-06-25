const { add } = require('lodash');
const GraphHelper = require('./helper');
const debug = require('debug')('bte:biothings-explorer-trapi:KnowledgeGraph');
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

  _createInputNode(record) {
    const res = {
      categories: 'biolink:' + helper._getInputCategory(record),
      name: helper._getInputLabel(record),
      attributes: [
        {
          name: 'equivalent_identifiers',
          value: helper._getInputEquivalentIds(record),
          type: 'biolink:id',
        },
      ],
    };
    const additional_attributes = helper._getInputAttributes(record);
    if (!(typeof additional_attributes === 'undefined')) {
      for (const key in additional_attributes) {
        res.attributes.push({
          name: key,
          value: additional_attributes[key],
          type: 'bts:' + key,
        });
      }
    }
    return res;
  }

  _createOutputNode(record) {
    const res = {
      categories: 'biolink:' + helper._getOutputCategory(record),
      name: helper._getOutputLabel(record),
      attributes: [
        {
          name: 'equivalent_identifiers',
          value: helper._getOutputEquivalentIds(record),
          type: 'biolink:id',
        },
      ],
    };
    const additional_attributes = helper._getOutputAttributes(record);
    if (!(typeof additional_attributes === 'undefined')) {
      for (const key in additional_attributes) {
        res.attributes.push({
          name: key,
          value: additional_attributes[key],
          type: 'bts:' + key,
        });
      }
    }
    return res;
  }

  _createAttributes(record) {
    const bteAttributes = ['name', 'label', 'id', 'api', 'provided_by'];
    const attributes = [
      {
        name: 'provided_by',
        value: helper._getSource(record),
        type: 'biolink:provided_by',
      },
      {
        name: 'api',
        value: helper._getAPI(record),
        type: 'bts:api',
      },
    ];
    Object.keys(record)
      .filter((k) => !(bteAttributes.includes(k) || k.startsWith('$')))
      .map((item) => {
        attributes.push({
          name: item,
          value: record[item],
          type: item === 'publications' ? 'biolink:' + item : 'bts:' + item,
        });
      });
    return attributes;
  }

  _createEdge(record) {
    return {
      predicate: helper._getPredicate(record),
      subject: helper._getInputID(record),
      object: helper._getOutputID(record),
      attributes: this._createAttributes(record),
    };
  }

  update(queryResult) {
    queryResult.map((record) => {
      if (!(helper._getInputID(record) in this.nodes)) {
        this.nodes[helper._getInputID(record)] = this._createInputNode(record);
      }
      if (!(helper._getOutputID(record) in this.nodes)) {
        this.nodes[helper._getOutputID(record)] = this._createOutputNode(record);
      }
      if (!(helper._createUniqueEdgeID(record) in this.edges)) {
        this.edges[helper._createUniqueEdgeID(record)] = this._createEdge(record);
      }
      // this.nodes = { ...this.nodes, ...this._createInputNode(record) };
      // this.nodes = { ...this.nodes, ...this._createOutputNode(record) };
      // this.edges = { ...this.edges, ...this._createEdge(record) };
    });
    this.kg = {
      nodes: this.nodes,
      edges: this.edges,
    };
  }
};
