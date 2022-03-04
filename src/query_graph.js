const QEdge = require('./query_edge');
const InvalidQueryGraphError = require('./exceptions/invalid_query_graph_error');
const LogEntry = require('./log_entry');
const ExeEdge = require('./query_execution_edge');
const debug = require('debug')('bte:biothings-explorer-trapi:query_graph');
const QNode = require('./query_node');
const id_resolver = require('biomedical_id_resolver');

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
    for (let qEdgeID in queryGraph.edges) {
      if (!(this.queryGraph.edges[qEdgeID].subject in queryGraph.nodes)) {
        throw new InvalidQueryGraphError(`The subject of edge ${qEdgeID} is not defined in the query graph.`);
      }
      if (!(this.queryGraph.edges[qEdgeID].object in queryGraph.nodes)) {
        throw new InvalidQueryGraphError(`The object of edge ${qEdgeID} is not defined in the query graph.`);
      }
    }
  }

  _validate(queryGraph) {
    this._validateEmptyEdges(queryGraph);
    this._validateEmptyNodes(queryGraph);
    this._validateNodeEdgeCorrespondence(queryGraph);
  }

  /**
   * @private
   */
    async _findNodeCategories(ids) { // TODO can ids be renamed to curies? can category be renamed to semantic type?
      if (ids.length == 1) {
        let category = await id_resolver.resolveSRI({
            unknown: ids
        });
        debug(`Query node missing categories...Looking for match...`);
        if (Object.hasOwnProperty.call(category, ids[0])) {
            category = category[ids[0]][0]['semanticType'];
            return ["biolink:" + category];
        }else{
            debug(`No category match found for ${JSON.stringify(ids)}.`);
            return [];
        }
    }else{
      debug(`(Error) Can't find category matches of multiple IDs.`);
      return [];
    }
  }

   /**
   * @private
   */
    async _storeNodes() {
      let nodes = {};
      for (let qNodeID in this.queryGraph.nodes) {
        //if node has ID but no categories
        if (
          (!Object.hasOwnProperty.call(this.queryGraph.nodes[qNodeID], 'categories') &&
          Object.hasOwnProperty.call(this.queryGraph.nodes[qNodeID], 'ids')) ||
          (Object.hasOwnProperty.call(this.queryGraph.nodes[qNodeID], 'categories') &&
          this.queryGraph.nodes[qNodeID].categories.length == 0 &&
          Object.hasOwnProperty.call(this.queryGraph.nodes[qNodeID], 'ids'))
          ) {
          let category = await this._findNodeCategories(this.queryGraph.nodes[qNodeID].ids);
          this.queryGraph.nodes[qNodeID].categories = category;
          debug(`Node category found. Assigning value: ${JSON.stringify(this.queryGraph.nodes[qNodeID])}`);
          this.logs.push(
            new LogEntry(
            'DEBUG',
            null,
            `Assigned missing node ID category: ${JSON.stringify(this.queryGraph.nodes[qNodeID])}`).getLog(),
          );
          nodes[qNodeID] = new QNode(qNodeID, this.queryGraph.nodes[qNodeID]);
        }else{
          debug(`Creating node...`);
          nodes[qNodeID] = new QNode(qNodeID, this.queryGraph.nodes[qNodeID]);
        }

      }
      this.logs.push(
        new LogEntry('DEBUG', null, `BTE identified ${Object.keys(nodes).length} QNodes from your query graph`).getLog(),
      );
      return nodes;
    }

  /**
   * @private
   */
   async _storeEdges() {
    if (this.nodes === undefined) {
      this.nodes = await this._storeNodes();
    }
    let edges = {};
    for (let qEdgeID in this.queryGraph.edges) {
      let edge_info = {
        ...this.queryGraph.edges[qEdgeID],
        ...{
          subject: this.nodes[this.queryGraph.edges[qEdgeID].subject],
          object: this.nodes[this.queryGraph.edges[qEdgeID].object],
        },
      };
      //store in each node ids of edges connected to them
      this.nodes[this.queryGraph.edges[qEdgeID].subject].updateConnection(qEdgeID);
      this.nodes[this.queryGraph.edges[qEdgeID].object].updateConnection(qEdgeID);

      edges[qEdgeID] = new QEdge(qEdgeID, edge_info);
    }
    this.logs.push(
      new LogEntry('DEBUG', null, `BTE identified ${Object.keys(edges).length} QEdges from your query graph`).getLog(),
    );
    return edges;
  }

  /**
   *
   */
  async calculateEdges() {
    this._validate(this.queryGraph);
    //populate edge and node info
    debug(`(1) Creating edges for manager...`);
    if (this.edges === undefined) {
      this.edges = await this._storeEdges();
    }
    let edges = {};
    let edge_index = 0;
    //create a smart query edge per edge in query
    for (const qEdgeID in this.edges) {
      edges[edge_index] = [
        // () ----> ()
        this.edges[qEdgeID].object.curie ?
          new ExeEdge(this.edges[qEdgeID], true, undefined) :
          new ExeEdge(this.edges[qEdgeID], false, undefined)
        // reversed () <---- ()
      ];
      edge_index++;
    }
    return edges;
  }

};
