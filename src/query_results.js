const GraphHelper = require('./helper');
const helper = new GraphHelper();
const debug = require('debug')('biothings-explorer-trapi:QueryResult');

module.exports = class QueryResult {
  constructor() {
    this.results = [];
  }

  getResults() {
    return this.results;
  }

  _createNodeBindings(record) {
    return {
      [helper._getInputQueryNodeID(record)]: [
        {
          id: helper._getInputID(record),
        },
      ],
      [helper._getOutputQueryNodeID(record)]: [
        {
          id: helper._getOutputID(record),
        },
      ],
    };
  }

  _createEdgeBindings(record) {
    return {
      [record.$edge_metadata.trapi_qEdge_obj.getID()]: [
        {
          id: helper._getKGEdgeID(record),
        },
      ],
    };
  }

  update(queryResult) {
    debug(`Updating query results now!`);
    queryResult.map((record) => {
      this.results.push({
        node_bindings: this._createNodeBindings(record),
        edge_bindings: this._createEdgeBindings(record),
      });
    });
  }
};
