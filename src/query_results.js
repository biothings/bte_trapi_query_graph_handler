const GraphHelper = require('./helper');
const helper = new GraphHelper();
const debug = require('debug')('biothings-explorer-trapi:QueryResult');

module.exports = class QueryResult {
  constructor() {
    this.results = [];
    this.node2index = {};
  }

  getResults() {
    return this.results;
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
    this.node2index = {};
    if (Object.keys(this.node2index).length == 0) {
      queryResult.map((record) => {
        const outputNodeID = helper._getOutputID(record)

        const node_bindings = {
          [helper._getInputQueryNodeID(record)]: [
            {
              id: helper._getInputID(record),
            },
          ],
          [helper._getOutputQueryNodeID(record)]: [
            {
              id: outputNodeID,
            },
          ],
        };

        const result = {
          node_bindings: node_bindings,
          edge_bindings: this._createEdgeBindings(record),
          //default score issue #200 - TODO: turn to evaluating module eventually
          score: '1.0',
        };
        this.results.push(result);
	this.node2index[outputNodeID] = this.results.length - 1;
      });
    } else {
      queryResult.forEach((record) => {
        const prevOutputNodeID = helper._getInputID(record);
        const resultIndex = this.node2index[prevOutputNodeID];
        const result = this.results[resultIndex];

        const newOutputNodeID = helper._getOutputID(record);
        result[helper._getOutputQueryNodeID(record)] = [
          {
            id: newOutputNodeID,
  	  },
        ];
	this.node2index[newOutputNodeID] = resultIndex;
      });
    }
  }
};
