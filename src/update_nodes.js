const id_resolver = require('biomedical_id_resolver');
const debug = require('debug')('bte:biothings-explorer-trapi:nodeUpdateHandler');

module.exports = class NodesUpdateHandler {
  constructor(qXEdges) {
    this.qXEdges = qXEdges;
  }

  /**
   * @private
   * s
   */
  _getCuries(qXEdges) {
    let curies = {};
    qXEdges.map((qXEdge) => {
      if (qXEdge.hasInputResolved()) {
        return;
      }
      if (qXEdge.hasInput()) {
        const inputCategories = qXEdge.getInputNode().getCategories();
        inputCategories.map((category) => {
          if (!(category in curies)) {
            curies[category] = [];
          }
          curies[category] = [...curies[category], ...qXEdge.getInputCurie()];
        });
      }
    });
    return curies;
  }

  /**
   * Resolve input ids
   * @param {object} curies - each key represents the category, e.g. gene, value is an array of curies.
   */
  async _getEquivalentIDs(curies) {
    // const resolver = new id_resolver.Resolver('biolink');
    // const equivalentIDs = await resolver.resolve(curies);
    const equivalentIDs = await id_resolver.resolveSRI(curies);
    return equivalentIDs;
  }

  async setEquivalentIDs(qXEdges) {
    debug(`Getting equivalent IDs...`);
    const curies = this._getCuries(this.qXEdges);
    debug(`curies: ${JSON.stringify(curies)}`);
    const equivalentIDs = await this._getEquivalentIDs(curies);
    qXEdges.map((qXEdge) => {
      const edgeEquivalentIDs = Object.keys(equivalentIDs)
        .filter((key) => qXEdge.getInputCurie().includes(key))
        .reduce((res, key) => {
          return { ...res, [key]: equivalentIDs[key] };
        }, {});
        debug(`Got Edge Equivalent IDs successfully.`);
      if (Object.keys(edgeEquivalentIDs).length > 0) {
        qXEdge.getInputNode().setEquivalentIDs(edgeEquivalentIDs);
      }
    });
    return;
  }

  _createEquivalentIDsObject(record) {
    if (record.object.normalizedInfo !== undefined) {
      return {
        [record.object.curie]: record.object.normalizedInfo,
      };
    } else {
      return;
    }
  }

  /**
   * Update nodes with equivalent ids based on query response.
   * @param {object} queryRecords - query response
   */
  update(queryRecords) {
    // queryRecords.map(record => {
    //     record.$edge_metadata.trapi_qEdge_obj.getOutputNode().updateEquivalentIDs(
    //         this._createEquivalentIDsObject(record)
    //     );
    // })
    queryRecords.map((record) => {
      if (
        record &&
        !(record.object.curie in record.qXEdge.getOutputNode().getEquivalentIDs())
      ) {
        record.qXEdge.getOutputNode().updateEquivalentIDs({[record.object.curie]: record.object.normalizedInfo});
      }
    });
  }
};
