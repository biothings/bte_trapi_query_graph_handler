const _ = require('lodash');
const LogEntry = require('./log_entry');
const config = require('./config');
const CURIE_WITH_PREFIXES = ['MONDO', 'DOID', 'UBERON', 'EFO', 'HP', 'CHEBI', 'CL', 'MGI', 'NCIT'];
const debug = require('debug')('bte:biothings-explorer-trapi:qedge2btedge');

const setImmediatePromise = () => {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
};

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
   * @param {object} qXEdge - TRAPI Query Edge Object
   */
  getMetaXEdges(qXEdge, metaKG = this.metaKG) {
    debug(`Input node is ${qXEdge.getInputNode().id}`);
    debug(`Output node is ${qXEdge.getOutputNode().id}`);
    this.logs.push(
      new LogEntry(
        'DEBUG',
        null,
        `BTE is trying to find metaKG edges (smartAPI registry, x-bte annotation) connecting from ${qXEdge.getInputNode().getCategories()} to ${qXEdge
          .getOutputNode()
          .getCategories()} with predicate ${qXEdge.getPredicate()}`,
      ).getLog(),
    );
    let filterCriteria = {
      input_type: qXEdge.getInputNode().getCategories(),
      output_type: qXEdge.getOutputNode().getCategories(),
      predicate: qXEdge.getPredicate(),
    };
    debug(`KG Filters: ${JSON.stringify(filterCriteria, null, 2)}`);
    let metaXEdges = metaKG.filter(filterCriteria).map((metaEdge) => {
      metaEdge.reasoner_edge = qXEdge;
      return metaEdge;
    });
    if (metaXEdges.length === 0) {
      debug(`No smartapi edge found for ${qXEdge.getID()}`);
      this.logs.push(
        new LogEntry('WARNING', null, `BTE didn't find any metaKG edges corresponding to ${qXEdge.getID()}`).getLog(),
      );
    } else {
      this.logs.push(
        new LogEntry(
          'DEBUG',
          null,
          `BTE found ${
            metaXEdges.length
          } metaKG edges corresponding to ${qXEdge.getID()}. These metaKG edges comes from ${
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
    for (const curie in resolvedCuries) {
      await Promise.all(resolvedCuries[curie].map(async (entity) => {
        if (entity.semanticType === inputType && inputPrefix in entity.dbIDs) {
          await Promise.all(entity.dbIDs[inputPrefix].map(async (id) => {
            let blockingSince = Date.now();
            const APIEdge = { ...metaXEdge };
            if (blockingSince + (parseInt(process.env.SETIMMEDIATE_TIME) || 3) < Date.now()) {
              await setImmediatePromise();
              blockingSince = Date.now();
            }
            APIEdge.input = id;
            APIEdge.input_resolved_identifiers = {
              [curie]: [entity],
            };
            if (CURIE_WITH_PREFIXES.includes(inputPrefix) || id.toString().includes(':')) {
              APIEdge.original_input = {
                [id]: curie,
              };
            } else {
              APIEdge.original_input = {
                [inputPrefix + ':' + id]: curie,
              };
            }
            blockingSince = Date.now();
            const edgeToBePushed = APIEdge;
            if (blockingSince + (parseInt(process.env.SETIMMEDIATE_TIME) || 3) < Date.now()) {
              await setImmediatePromise();
              blockingSince = Date.now();
            }
            edgeToBePushed.reasoner_edge = metaXEdge.reasoner_edge;
            APIEdges.push(edgeToBePushed);
          }));
        }
      }));
    }
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
    for (const curie in resolvedCuries) {
      resolvedCuries[curie].map((entity) => {
        if (metaXEdge.tags.includes('bte-trapi')) {
          if (entity.semanticType === inputType) {
            input_resolved_identifiers[curie] = [entity];
            inputs.push(entity.primaryID);
            id_mapping[entity.primaryID] = curie;
          }
        } else if (entity.semanticType === inputType && inputPrefix in entity.dbIDs) {
          entity.dbIDs[inputPrefix].map((id) => {
            if (CURIE_WITH_PREFIXES.includes(inputPrefix) || id.includes(':')) {
              id_mapping[id] = curie;
            } else {
              id_mapping[inputPrefix + ':' + id] = curie;
            }
            input_resolved_identifiers[curie] = [entity];
            inputs.push(id);
          });
        }
      });
    }

    let batchSize = Infinity;
    if (metaXEdge.tags.includes('biothings')) {
      batchSize = 1000;
    }
    let configuredLimit = metaXEdge.query_operation.batchSize;
    if (metaXEdge.association["x-trapi"]?.batch_size_limit) {
      configuredLimit = metaXEdge.association["x-trapi"].batch_size_limit < configuredLimit || !configuredLimit
        ? metaXEdge.association["x-trapi"].batch_size_limit
        : configuredLimit;
    }
    let hardLimit = config.API_BATCH_SIZE.find((api) => {
      return api.id === metaXEdge.association.smartapi.id || api.name === metaXEdge.association.api_name;
    });
    // BTE internal configured limit takes precedence over annotated limit
    batchSize = hardLimit
      ? hardLimit.max
      : configuredLimit ? configuredLimit : batchSize;
    if (Object.keys(id_mapping).length > 0) {
      await Promise.all(_.chunk(inputs, batchSize).map(async (chunk) => {
        let blockingSince = Date.now();
        const APIEdge = { ...metaXEdge };
        if (blockingSince + (parseInt(process.env.SETIMMEDIATE_TIME) || 3) < Date.now()) {
          await setImmediatePromise();
          blockingSince = Date.now();
        }
        APIEdge.input = chunk;
        APIEdge.input_resolved_identifiers = input_resolved_identifiers;
        APIEdge.original_input = id_mapping;
        const edgeToBePushed = APIEdge;
        edgeToBePushed.reasoner_edge = metaXEdge.reasoner_edge;
        APIEdges.push(edgeToBePushed);
        }),
      );
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
    const resolvedCuries = metaXEdge.reasoner_edge.getInputNode().getEquivalentIDs()
    for (const curie in resolvedCuries) {
      resolvedCuries[curie].map((entity) => {
        if (entity.semanticType === inputType && inputPrefix in entity.dbIDs) {
          entity.dbIDs[inputPrefix].map((id) => {
            const APIEdge = { ...metaXEdge };
            APIEdge.input = { queryInputs: id, ...APIEdge.query_operation.templateInputs };
            APIEdge.input_resolved_identifiers = {
              [curie]: [entity],
            };
            if (CURIE_WITH_PREFIXES.includes(inputPrefix) || id.toString().includes(':')) {
              APIEdge.original_input = {
                [id]: curie,
              };
            } else {
              APIEdge.original_input = {
                [inputPrefix + ':' + id]: curie,
              };
            }
            const edgeToBePushed = APIEdge;
            edgeToBePushed.reasoner_edge = metaXEdge.reasoner_edge;
            APIEdges.push(edgeToBePushed);
          });
        }
      });
    }
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
    for (const curie in resolvedCuries) {
      resolvedCuries[curie].map((entity) => {
        if (metaXEdge.tags.includes('bte-trapi')) {
          if (entity.semanticType === inputType) {
            input_resolved_identifiers[curie] = [entity];
            inputs.push(entity.primaryID);
            id_mapping[entity.primaryID] = curie;
          }
        } else if (entity.semanticType === inputType && inputPrefix in entity.dbIDs) {
          entity.dbIDs[inputPrefix].map((id) => {
            if (CURIE_WITH_PREFIXES.includes(inputPrefix) || id.includes(':')) {
              id_mapping[id] = curie;
            } else {
              id_mapping[inputPrefix + ':' + id] = curie;
            }
            input_resolved_identifiers[curie] = [entity];
            inputs.push(id);
          });
        }
      });
    }
    let batchSize = Infinity;
    if (metaXEdge.tags.includes('biothings')) {
      batchSize = 1000;
    }
    let configuredLimit = metaXEdge.query_operation.batchSize;
    let hardLimit = config.API_BATCH_SIZE.find((api) => {
      return api.id === metaXEdge.association.smartapi.id || api.name === metaXEdge.association.api_name;
    });
    // BTE internal configured limit takes precedence over annotated limit
    batchSize = hardLimit
      ? hardLimit.max
      : configuredLimit ? configuredLimit : batchSize;
    if (Object.keys(id_mapping).length > 0) {
      await Promise.all(_.chunk(inputs, batchSize).map(async (chunk) => {
        let blockingSince = Date.now();
        const APIEdge = { ...metaXEdge };
        if (blockingSince + (parseInt(process.env.SETIMMEDIATE_TIME) || 3) < Date.now()) {
          await setImmediatePromise();
          blockingSince = Date.now();
        }
        APIEdge.input = { queryInputs: chunk, ...APIEdge.query_operation.templateInputs };
        APIEdge.input_resolved_identifiers = input_resolved_identifiers;
        APIEdge.original_input = id_mapping;
        const edgeToBePushed = APIEdge;
        edgeToBePushed.reasoner_edge = metaXEdge.reasoner_edge;
        APIEdges.push(edgeToBePushed);
      }));
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

  async convert(qXEdges) {
    let APIEdges = [];
    await Promise.all(qXEdges.map(async (qXEdge) => {
      const metaXedges = await this.getMetaXEdges(qXEdge);
      const apis = _.uniq(metaXedges.map(api => api.association.api_name));
      debug(`${apis.length} APIs being used:`, JSON.stringify(apis));
      debug(`${metaXedges.length} SmartAPI edges are retrieved....`);
      await Promise.all(metaXedges.map(async (metaXEdge) => {
        let newEdges = await this._createAPIEdges(metaXEdge);
        debug(`${newEdges.length} metaKG are created....`);
        newEdges = newEdges.map((e) => {
          e.filter = qXEdge.filter;
          return e;
        });
        APIEdges = [...APIEdges, ...newEdges];
      }));
    }));
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
