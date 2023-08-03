const _ = require('lodash');
const LogEntry = require('./log_entry');
const config = require('./config');
const CURIE_WITH_PREFIXES = ['MONDO', 'DOID', 'UBERON', 'EFO', 'HP', 'CHEBI', 'CL', 'MGI', 'NCIT'];
const debug = require('debug')('bte:biothings-explorer-trapi:qedge2btedge');
const async = require('async');

module.exports = class QEdge2APIEdgeHandler {
  constructor(qEdges, metaKG) {
    this.qEdges = qEdges;
    this.metaKG = metaKG;
    this.logs = [];
  }

  setQEdges(qEdges) {
    this.qEdges = qEdges;
  }

  _findAPIsFromMetaEdges(metaEdges) {
    return metaEdges.map((edge) => edge.association.api_name);
  }

  /**
   * Get SmartAPI Edges based on TRAPI Query Edge.
   * @private
   * @param {object} metaKG - SmartAPI Knowledge Graph Object
   * @param {object} qEdge - TRAPI Query Edge Object
   */
  getMetaXEdges(qEdge, metaKG = this.metaKG) {
    debug(`Input node is ${qEdge.getInputNode().id}`);
    debug(`Output node is ${qEdge.getOutputNode().id}`);
    this.logs.push(
      new LogEntry(
        'DEBUG',
        null,
        `BTE is trying to find metaKG edges (smartAPI registry, x-bte annotation) connecting from ${qEdge
          .getInputNode()
          .getCategories()} to ${qEdge.getOutputNode().getCategories()} with predicate ${qEdge.getPredicate()}`,
      ).getLog(),
    );
    let filterCriteria = {
      input_type: qEdge.getInputNode().getCategories(),
      output_type: qEdge.getOutputNode().getCategories(),
      predicate: qEdge.getPredicate(),
      qualifiers: qEdge.getSimpleExpandedQualifierConstraints(),
    };
    debug(`KG Filters: ${JSON.stringify(filterCriteria, null, 2)}`);
    let metaXEdges = metaKG.filter(filterCriteria).map((metaEdge) => {
      metaEdge.reasoner_edge = qEdge;
      return metaEdge;
    });
    if (metaXEdges.length === 0) {
      debug(`No smartapi edge found for ${qEdge.getID()}`);
      this.logs.push(
        new LogEntry('WARNING', null, `BTE didn't find any metaKG edges corresponding to ${qEdge.getID()}`).getLog(),
      );
    } else {
      this.logs.push(
        new LogEntry(
          'DEBUG',
          null,
          `BTE found ${
            metaXEdges.length
          } metaKG edges corresponding to ${qEdge.getID()}. These metaKG edges comes from ${
            new Set(this._findAPIsFromMetaEdges(metaXEdges)).size
          } unique APIs. They are ${Array.from(new Set(this._findAPIsFromMetaEdges(metaXEdges))).join(',')}`,
        ).getLog(),
      );
    }
    return metaXEdges;
  }

  /**
   * @private
   * @param {object} resolvedIDs
   * @param {object} metaXEdge
   */
  async _createNonBatchSupportAPIEdges(metaXEdge) {
    const APIEdges = [];
    const inputPrefix = metaXEdge.association.input_id;
    const inputType = metaXEdge.association.input_type;
    const resolvedCuries = metaXEdge.reasoner_edge.getInputNode().getEquivalentIDs();
    Object.entries(resolvedCuries).forEach(([curie, entity]) => {
      if (entity.primaryTypes.includes(inputType.replace('biolink:', ''))) {
        entity.equivalentIDs.forEach((equivalentCurie) => {
          if (equivalentCurie.toUpperCase().includes(inputPrefix.toUpperCase())) {
            // make sure the case of prefix matches the inputPrefix
            equivalentCurie = equivalentCurie.replace(new RegExp(inputPrefix, "i"), inputPrefix);

            const id = CURIE_WITH_PREFIXES.includes(equivalentCurie.split(':')[0].toUpperCase())
              ? [equivalentCurie.split(':')[0].toUpperCase(), ...equivalentCurie.split(':').slice(1)].join(':')
              : equivalentCurie.split(':').slice(1).join(':');
            const APIEdge = { ...metaXEdge };
            APIEdge.input = id;
            APIEdge.input_resolved_identifiers = {
              [curie]: entity,
            };
            APIEdge.original_input = {
              [equivalentCurie]: curie,
            };
            const edgeToBePushed = APIEdge;
            edgeToBePushed.reasoner_edge = metaXEdge.reasoner_edge;
            APIEdges.push(edgeToBePushed);
          }
        });
      }
    });
    return APIEdges;
  }

  /**
   * @private
   * @param {object} resolvedIDs
   * @param {object} metaXEdge
   */
  async _createBatchSupportAPIEdges(metaXEdge) {
    const id_mapping = {};
    const inputs = [];
    const APIEdges = [];
    const input_resolved_identifiers = {};
    const inputPrefix = metaXEdge.association.input_id;
    const inputType = metaXEdge.association.input_type;
    let resolvedCuries = metaXEdge.reasoner_edge.getInputNode().getEquivalentIDs();
    // debug(`Resolved ids: ${JSON.stringify(resolvedIDs)}`);
    debug(`Input prefix: ${inputPrefix}`);
    Object.entries(resolvedCuries).forEach(([curie, entity]) => {
      if (metaXEdge.tags.includes('bte-trapi')) {
        if (entity.primaryTypes.includes(inputType.replace('biolink:', ''))) {
          input_resolved_identifiers[curie] = entity;
          inputs.push(entity.primaryID);
          id_mapping[entity.primaryID] = curie;
        }
      } else if (entity.primaryTypes.includes(inputType.replace('biolink:', ''))) {
        entity.equivalentIDs.forEach((equivalentCurie) => {
          if (equivalentCurie.toUpperCase().includes(inputPrefix.toUpperCase())) {
            // make sure the case of prefix matches the inputPrefix
            equivalentCurie = equivalentCurie.replace(new RegExp(inputPrefix, "i"), inputPrefix);

              const id = CURIE_WITH_PREFIXES.includes(equivalentCurie.split(':')[0].toUpperCase())
                  ? [equivalentCurie.split(':')[0].toUpperCase(), ...equivalentCurie.split(':').slice(1)].join(':')
                  : equivalentCurie.split(':').slice(1).join(':');
            id_mapping[equivalentCurie] = curie;
            input_resolved_identifiers[curie] = entity;
            inputs.push(id);
          }
        });
      }
    });

    let batchSize = Infinity;
    if (metaXEdge.tags.includes('biothings')) {
      batchSize = 1000;
    }
    let configuredLimit = metaXEdge.query_operation.batchSize;
    if (metaXEdge.association['x-trapi']?.batch_size_limit) {
      configuredLimit =
        metaXEdge.association['x-trapi'].batch_size_limit < configuredLimit || !configuredLimit
          ? metaXEdge.association['x-trapi'].batch_size_limit
          : configuredLimit;
    }
    let hardLimit = config.API_BATCH_SIZE.find((api) => {
      return api.id === metaXEdge.association.smartapi.id || api.name === metaXEdge.association.api_name;
    });
    // BTE internal configured limit takes precedence over annotated limit
    batchSize = hardLimit ? hardLimit.max : configuredLimit ? configuredLimit : batchSize;
    if (Object.keys(id_mapping).length > 0) {
      _.chunk(inputs, batchSize).forEach((chunk) => {
        const APIEdge = { ...metaXEdge };
        APIEdge.input = chunk;
        APIEdge.input_resolved_identifiers = input_resolved_identifiers;
        APIEdge.original_input = id_mapping;
        const edgeToBePushed = APIEdge;
        edgeToBePushed.reasoner_edge = metaXEdge.reasoner_edge;
        APIEdges.push(edgeToBePushed);
      });
    }
    return APIEdges;
  }

  /**
   * @private
   * @param {object} resolvedIDs
   * @param {object} metaXEdge
   */
  async _createTemplatedNonBatchSupportAPIEdges(metaXEdge) {
    const APIEdges = [];
    const inputPrefix = metaXEdge.association.input_id;
    const inputType = metaXEdge.association.input_type;
    const resolvedCuries = metaXEdge.reasoner_edge.getInputNode().getEquivalentIDs();
    Object.entries(resolvedCuries).forEach(([curie, entity]) => {
      if (entity.primaryTypes.includes(inputType.replace('biolink:', ''))) {
        entity.equivalentIDs.forEach((equivalentCurie) => {
          if (equivalentCurie.toUpperCase().includes(inputPrefix.toUpperCase())) {
            // make sure the case of prefix matches the inputPrefix
            equivalentCurie = equivalentCurie.replace(new RegExp(inputPrefix, "i"), inputPrefix);

            const id = CURIE_WITH_PREFIXES.includes(equivalentCurie.split(':')[0].toUpperCase())
              ? [equivalentCurie.split(':')[0].toUpperCase(), ...equivalentCurie.split(':').slice(1)].join(':')
              : equivalentCurie.split(':').slice(1).join(':');
            const APIEdge = { ...metaXEdge };
            APIEdge.input = { queryInputs: id, ...APIEdge.query_operation.templateInputs };
            APIEdge.input_resolved_identifiers = {
              [curie]: entity,
            };
            APIEdge.original_input = {
              [equivalentCurie]: curie,
            };
            const edgeToBePushed = APIEdge;
            edgeToBePushed.reasoner_edge = metaXEdge.reasoner_edge;
            APIEdges.push(edgeToBePushed);
          }
        });
      }
    });
    return APIEdges;
  }

  /**
   * @private
   * @param {object} resolvedIDs
   * @param {object} metaXEdge
   */
  async _createTemplatedBatchSupportAPIEdges(metaXEdge) {
    const id_mapping = {};
    const inputs = [];
    const APIEdges = [];
    const input_resolved_identifiers = {};
    const inputPrefix = metaXEdge.association.input_id;
    const inputType = metaXEdge.association.input_type;
    let resolvedCuries = metaXEdge.reasoner_edge.getInputNode().getEquivalentIDs();
    // debug(`Resolved ids: ${JSON.stringify(resolvedIDs)}`);
    debug(`Input prefix: ${inputPrefix}`);
    Object.entries(resolvedCuries).forEach(([curie, entity]) => {
      if (metaXEdge.tags.includes('bte-trapi')) {
        if (entity.primaryTypes.includes(inputType.replace('biolink:', ''))) {
          input_resolved_identifiers[curie] = entity;
          inputs.push(entity.primaryID);
          id_mapping[entity.primaryID] = curie;
        }
      } else if (entity.primaryTypes.includes(inputType.replace('biolink:', ''))) {
        entity.equivalentIDs.forEach((equivalentCurie) => {
          if (equivalentCurie.toUpperCase().includes(inputPrefix.toUpperCase())) {
            // make sure the case of prefix matches the inputPrefix
            equivalentCurie = equivalentCurie.replace(new RegExp(inputPrefix, "i"), inputPrefix);

            const id = CURIE_WITH_PREFIXES.includes(equivalentCurie.split(':')[0].toUpperCase())
              ? [equivalentCurie.split(':')[0].toUpperCase(), ...equivalentCurie.split(':').slice(1)].join(':')
              : equivalentCurie.split(':').slice(1).join(':');
            id_mapping[equivalentCurie] = curie;
            input_resolved_identifiers[curie] = entity;
            inputs.push(id);
          }
        });
      }
    });
    let batchSize = Infinity;
    if (metaXEdge.tags.includes('biothings')) {
      batchSize = 1000;
    }
    let configuredLimit = metaXEdge.query_operation.batchSize;
    let hardLimit = config.API_BATCH_SIZE.find((api) => {
      return api.id === metaXEdge.association.smartapi.id || api.name === metaXEdge.association.api_name;
    });
    // BTE internal configured limit takes precedence over annotated limit
    batchSize = hardLimit ? hardLimit.max : configuredLimit ? configuredLimit : batchSize;
    if (Object.keys(id_mapping).length > 0) {
      _.chunk(inputs, batchSize).forEach((chunk) => {
        const APIEdge = { ...metaXEdge };
        APIEdge.input = { queryInputs: chunk, ...APIEdge.query_operation.templateInputs };
        APIEdge.input_resolved_identifiers = input_resolved_identifiers;
        APIEdge.original_input = id_mapping;
        const edgeToBePushed = APIEdge;
        edgeToBePushed.reasoner_edge = metaXEdge.reasoner_edge;
        APIEdges.push(edgeToBePushed);
      });
    }
    return APIEdges;
  }

  /**
   * Add inputs to smartapi edges
   */
  async _createAPIEdges(metaXEdge) {
    const supportBatch = metaXEdge.query_operation.supportBatch;
    const useTemplating = metaXEdge.query_operation.useTemplating;
    let APIEdges;
    if (supportBatch === false) {
      APIEdges = useTemplating
        ? await this._createTemplatedNonBatchSupportAPIEdges(metaXEdge)
        : await this._createNonBatchSupportAPIEdges(metaXEdge);
    } else {
      APIEdges = useTemplating
        ? await this._createTemplatedBatchSupportAPIEdges(metaXEdge)
        : await this._createBatchSupportAPIEdges(metaXEdge);
    }
    return APIEdges;
  }

  async convert(qEdges) {
    let APIEdges = [];
    await Promise.all(
      qEdges.map(async (qEdge) => {
        const metaXedges = await this.getMetaXEdges(qEdge);
        const apis = _.uniq(metaXedges.map((api) => api.association.api_name));
        debug(`${apis.length} APIs being used:`, JSON.stringify(apis));
        debug(`${metaXedges.length} SmartAPI edges are retrieved....`);
        await Promise.all(
          metaXedges.map(async (metaXEdge) => {
            let newEdges = await this._createAPIEdges(metaXEdge);
            debug(`${newEdges.length} metaKG are created....`);
            newEdges = newEdges.map((e) => {
              e.filter = qEdge.filter;
              return e;
            });
            APIEdges = [...APIEdges, ...newEdges];
          }),
        );
      }),
    );
    if (APIEdges.length === 0) {
      debug(`No metaKG found for this query batch.`);
      this.logs.push(
        new LogEntry('WARNING', null, `BTE didn't find any metaKG for this batch. Your query terminates.`).getLog(),
      );
    } else {
      debug(`BTE found ${APIEdges.length} metaKG for this batch.`);
      this.logs.push(new LogEntry('DEBUG', null, `BTE found ${APIEdges.length} metaKG for this batch.`).getLog());
    }
    return APIEdges;
  }
};
