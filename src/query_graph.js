const QNode = require('./query_node');
const QEdge = require('./query_edge');
const QExecEdge = require('./query_execution_edge');
const _ = require('lodash');
const InvalidQueryGraphError = require('./exceptions/invalid_query_graph_error');
const LogEntry = require('./log_entry');
const MAX_DEPTH = 3;

module.exports = class QueryGraphHandler {
  constructor(queryGraph) {
    this.queryGraph = queryGraph;
    this.logs = [];
  }

  _validateEmptyNodes(queryGraph) {
    if (Object.keys(queryGraph.nodes).length === 0) {
      throw new InvalidQueryGraphError('Your Query Graph has no nodes defined.');
    }
  }

  _validateEmptyEdges(queryGraph) {
    if (Object.keys(queryGraph.edges).length === 0) {
      throw new InvalidQueryGraphError('Your Query Graph has no edges defined.');
    }
  }

  _validateNodeEdgeCorrespondence(queryGraph) {
    for (let edge_id in queryGraph.edges) {
      if (!(this.queryGraph.edges[edge_id].subject in queryGraph.nodes)) {
        throw new InvalidQueryGraphError(`The subject of edge ${edge_id} is not defined in the query graph.`);
      }
      if (!(this.queryGraph.edges[edge_id].object in queryGraph.nodes)) {
        throw new InvalidQueryGraphError(`The object of edge ${edge_id} is not defined in the query graph.`);
      }
    }
  }

  _validate(queryGraph) {
    this._validateEmptyEdges(queryGraph);
    this._validateEmptyNodes(queryGraph);
    this._validateNodeEdgeCorrespondence(queryGraph);
  }

  _modify(queryGraph) {
    Object.keys(queryGraph.nodes).map((nodeID) => {
      if (queryGraph.nodes[nodeID].category === 'biolink:Drug') {
        queryGraph.nodes[nodeID].category = ['biolink:Drug', 'biolink:ChemicalSubstance'];
      }
    });
    return queryGraph;
  }

  /**
   * @private
   */
  _storeNodes() {
    let nodes = {};
    for (let node_id in this.queryGraph.nodes) {
      nodes[node_id] = new QNode(node_id, this.queryGraph.nodes[node_id]);
    }
    this.logs.push(
      new LogEntry('DEBUG', null, `BTE identified ${Object.keys(nodes).length} QNodes from your query graph`).getLog(),
    );
    return nodes;
  }

  /**
   * @private
   */
  _storeEdges() {
    if (this.nodes === undefined) {
      this.nodes = this._storeNodes();
    }
    let edges = {};
    for (let edge_id in this.queryGraph.edges) {
      let edge_info = {
        ...this.queryGraph.edges[edge_id],
        ...{
          subject: this.nodes[this.queryGraph.edges[edge_id].subject],
          object: this.nodes[this.queryGraph.edges[edge_id].object],
        },
      };
      edges[edge_id] = new QEdge(edge_id, edge_info);
    }
    this.logs.push(
      new LogEntry('DEBUG', null, `BTE identified ${Object.keys(edges).length} QEdges from your query graph`).getLog(),
    );
    return edges;
  }

  /**
   *
   */
  createQueryPaths() {
    this._validate(this.queryGraph);
    this.queryGraph = this._modify(this.queryGraph);
    let paths = {};
    let FirstLevelEdges = this._findFirstLevelEdges();
    paths[0] = FirstLevelEdges.paths;
    let output_nodes = FirstLevelEdges.output_nodes;
    for (let i = 1; i < MAX_DEPTH; i++) {
      let ithLevelEdges = this._findNextLevelEdges(output_nodes);
      output_nodes = ithLevelEdges.output_nodes;
      if (output_nodes.length === 0) {
        break;
      }
      paths[i] = current_graph.map((item) => item.edge);
    }
    this.logs.push(
      new LogEntry(
        'DEBUG',
        null,
        `BTE identified your query graph as a ${Object.keys(paths).length}-depth query graph`,
      ).getLog(),
    );
    return paths;
  }

  /**
   * @private
   */
  _findFirstLevelEdges() {
    if (this.edges === undefined) {
      this.edges = this._storeEdges();
    }
    const result = [];
    for (const edge_id in this.edges) {
      const subjectNode = this.edges[edge_id].subject;
      const objectNode = this.edges[edge_id].object;
      if (subjectNode.hasInput()) {
        result.push({
          current_node: objectNode,
          edge: new QExecEdge(this.edges[edge_id], false, undefined),
          path_source_node: subjectNode,
        });
      }
      if (objectNode.hasInput()) {
        result.push({
          current_node: subjectNode,
          edge: new QExecEdge(this.edges[edge_id], true, undefined),
          path_source_node: objectNode,
        });
      }
    }
    return result;
  }

  /**
   * @private
   */
  _findNextLevelEdges(groups) {
    const result = [];
    for (const edge of Object.values(this.edges)) {
      for (const grp of groups) {
        if (edge.getID() !== grp.edge.getID()) {
          if (edge.subject.getID() === grp.current_node.getID()) {
            result.push({
              current_node: edge.object,
              edge: new QExecEdge(edge, false, grp.edge),
              path_source_node: grp.path_source_node,
            });
          } else if (edge.object.getID() === grp.current_node.getID()) {
            result.push({
              current_node: edge.subject,
              edge: new QExecEdge(edge, true, grp.edge),
              path_source_node: grp.path_source_node,
            });
          }
        }
      }
    }
    return result;
  }
};
