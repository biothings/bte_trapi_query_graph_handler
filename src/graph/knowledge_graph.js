const debug = require('debug')('bte:biothings-explorer-trapi:KnowledgeGraph');

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
      categories: ['biolink:' + kgNode._semanticType],
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
    let attributes = [
      {
        attribute_type_id: 'biolink:aggregator_knowledge_source',
        value: ['infores:biothings-explorer'],
        value_type_id: 'biolink:InformationResource',
      },
    ];

    if (kgEdge.attributes['edge-attributes']) {
      //handle TRAPI APIs (Situation A of https://github.com/biothings/BioThings_Explorer_TRAPI/issues/208) and APIs that define 'edge-atributes' in x-bte
      const kgEdgeAggregator = kgEdge.attributes['edge-attributes'].find(attr => attr.attribute_type_id === 'biolink:aggregator_knowledge_source');
      if (kgEdgeAggregator) {
        kgEdgeAggregator.value = Array.isArray(kgEdgeAggregator.value) ? ['infores:biothings-explorer', ...kgEdgeAggregator.value] : ['infores:biothings-explorer', kgEdgeAggregator.value]
        attributes = [...kgEdge.attributes['edge-attributes'].filter(attr => attr.attribute_type_id !== 'biolink:aggregator_knowledge_source'), kgEdgeAggregator]
      } else {
        attributes = [...attributes, ...kgEdge.attributes['edge-attributes']];
      }
    } else if (
      //handle direct info providers (Situation C of https://github.com/biothings/BioThings_Explorer_TRAPI/issues/208)
      [
        'Clinical Risk KP API',
        'Text Mining Targeted Association API',
        'Multiomics Wellness KP API',
        'Drug Response KP API',
        'Text Mining Co-occurrence API',
        'TCGA Mutation Frequency API',
      ].some((api_name) => kgEdge.apis.has(api_name))
    ) {
      attributes = [...attributes];
      //primary knowledge source
      if (Array.from(kgEdge.sources).length) {
        attributes = [
          ...attributes,
          {
            attribute_type_id: 'biolink:primary_knowledge_source',
            value: Array.from(kgEdge.sources),
            value_type_id: 'biolink:InformationResource',
          },
        ];
      }
      //aggregator knowledge source
      if (Array.from(kgEdge.inforesCuries).length) {
        attributes = [
          ...attributes.filter(attr => attr.attribute_type_id !== 'biolink:aggregator_knowledge_source'),
          {
            attribute_type_id: 'biolink:aggregator_knowledge_source',
            value: ['infores:biothings-explorer', ...Array.from(kgEdge.inforesCuries)],
            value_type_id: 'biolink:InformationResource',
          },
        ];
      }
      //publications
      if (Array.from(kgEdge.publications).length) {
        attributes = [
          ...attributes,
          {
            attribute_type_id: 'biolink:publications',
            value: Array.from(kgEdge.publications),
            // value_type_id: 'biolink:publications',
          },
        ];
      }

      for (const key in kgEdge.attributes) {
        attributes.push({
          attribute_type_id: key,
          value: Array.from(kgEdge.attributes[key]),
          //value_type_id: 'bts:' + key,
        });
      }
    } else {
      //handle non-trapi APIs (Situation B of https://github.com/biothings/BioThings_Explorer_TRAPI/issues/208)
      attributes = [...attributes];
      //primary knowledge source
      if (Array.from(kgEdge.sources).length) {
        attributes = [
          ...attributes,
          {
            attribute_type_id: 'biolink:primary_knowledge_source',
            value: Array.from(kgEdge.sources),
            value_type_id: 'biolink:InformationResource',
          },
        ];
      }
      //aggregator knowledge source
      if (Array.from(kgEdge.inforesCuries).length) {
        attributes = [
          ...attributes.filter(attr => attr.attribute_type_id !== 'biolink:aggregator_knowledge_source'),
          {
            attribute_type_id: 'biolink:aggregator_knowledge_source',
            value: ['infores:biothings-explorer', ...Array.from(kgEdge.inforesCuries)],
            value_type_id: 'biolink:InformationResource',
          },
        ];
      }
      //publications
      if (Array.from(kgEdge.publications).length) {
        attributes = [
          ...attributes,
          {
            attribute_type_id: 'biolink:publications',
            value: Array.from(kgEdge.publications),
            // value_type_id: 'biolink:publications',
          },
        ];
      }

      for (const key in kgEdge.attributes) {
        attributes.push({
          attribute_type_id: key,
          value: Array.from(kgEdge.attributes[key]),
          //value_type_id: 'bts:' + key,
        });
      }
    }

    return attributes;
  }

  _createEdge(kgEdge) {
    return {
      predicate: kgEdge.predicate,
      subject: kgEdge.subject,
      object: kgEdge.object,
      qualifiers: this._createQualifiers(kgEdge),
      attributes: this._createAttributes(kgEdge),
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
