const debug = require('debug')('bte:biothings-explorer-trapi:KnowledgeGraph');

module.exports = class KnowledgeGraph {
  constructor(apiList) {
    this.nodes = {};
    this.edges = {};
    this.kg = {
      nodes: this.nodes,
      edges: this.edges,
    };
    this.apiList = apiList;
  }

  getNodes() {
    return this.nodes;
  }

  getEdges() {
    return this.edges;
  }

  _createNode(kgNode) {
    const res = {
      categories: kgNode._semanticType,
      name: kgNode._label,
      attributes: [
        {
          attribute_type_id: 'biolink:xref',
          value: kgNode._curies,
        },
        {
          attribute_type_id: 'biolink:synonym',
          value: kgNode._names,
        },
        // Currently unused
        // {
        //   attribute_type_id: 'num_source_nodes',
        //   value: kgNode._sourceNodes.size,
        //   //value_type_id: 'bts:num_source_nodes',
        // },
        // {
        //   attribute_type_id: 'num_target_nodes',
        //   value: kgNode._targetNodes.size,
        //   //value_type_id: 'bts:num_target_nodes',
        // },
        // {
        //   attribute_type_id: 'source_qg_nodes',
        //   value: Array.from(kgNode._sourceQNodeIDs),
        //   //value_type_id: 'bts:source_qg_nodes',
        // },
        // {
        //   attribute_type_id: 'target_qg_nodes',
        //   value: Array.from(kgNode._targetQNodeIDs),
        //   //value_type_id: 'bts:target_qg_nodes',
        // },
      ],
    };
    for (const key in kgNode._nodeAttributes) {
      res.attributes.push({
        attribute_type_id: key,
        value: kgNode._nodeAttributes[key],
        //value_type_id: 'bts:' + key,
      });
    }
    return res;
  }

  _createQualifiers(kgEdge) {
    const qualifiers = Object.entries(kgEdge.qualifiers || {}).map(([qualifierType, qualifier]) => {
      return {
        qualifier_type_id: qualifierType,
        qualifier_value: qualifier,
      };
    });

    return qualifiers.length ? qualifiers : undefined;
  }

  _createAttributes(kgEdge) {
    const attributes = [];

    // publications
    if (Array.from(kgEdge.publications).length) {
      attributes.push({
        attribute_type_id: 'biolink:publications',
        value: Array.from(kgEdge.publications),
        // value_type_id: 'biolink:publications',
      });
    }

    Object.entries(kgEdge.attributes).forEach(([key, value]) => {
      if (key == 'edge-attributes') return;
      attributes.push({
        attribute_type_id: key,
        value: Array.from(value),
        //value_type_id: 'bts:' + key,
      });
    });

    //handle TRAPI APIs (Situation A of https://github.com/biothings/BioThings_Explorer_TRAPI/issues/208) and APIs that define 'edge-atributes' in x-bte
    kgEdge.attributes['edge-attributes']?.forEach((attribute) => {
      attributes.push(attribute);
    });
    return attributes;
  }

  _createSources(kgEdge) {
    const sources = [];
    Object.entries(kgEdge.sources).forEach(([resource_id, roles]) => {
      Object.entries(roles).forEach(([resource_role, sourceObj]) => {
        if (sourceObj.upstream_resource_ids) sourceObj.upstream_resource_ids = [...sourceObj.upstream_resource_ids];
        sources.push(sourceObj);
      });
    });
    return sources;
  }

  _createEdge(kgEdge) {
    return {
      predicate: kgEdge.predicate,
      subject: kgEdge.subject,
      object: kgEdge.object,
      qualifiers: this._createQualifiers(kgEdge),
      attributes: this._createAttributes(kgEdge),
      sources: this._createSources(kgEdge),
    };
  }

  update(bteGraph) {
    Object.keys(bteGraph.nodes).map((node) => {
      this.nodes[bteGraph.nodes[node]._primaryCurie] = this._createNode(bteGraph.nodes[node]);
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
