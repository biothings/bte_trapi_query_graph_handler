const QEdge = require('./query_edge');
const InvalidQueryGraphError = require('./exceptions/invalid_query_graph_error');
const LogEntry = require('./log_entry');
const ExeEdge = require('./query_execution_edge');
const debug = require('debug')('bte:biothings-explorer-trapi:query_graph');
const QNode = require('./query_node');
const biolink = require('./biolink');
const id_resolver = require('biomedical_id_resolver');
const _ = require('lodash');
const utils = require('./utils');

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

  /**
   * @private
   */
  async _findNodeCategories(ids) {
    const noMatchMessage = `No category match found for ${JSON.stringify(ids)}.`;
    if (ids.length == 1) {
      let category = await id_resolver.resolveSRI({
          unknown: ids
      });
      debug(`Query node missing categories...Looking for match...`);
      if (Object.hasOwnProperty.call(category, ids[0])) {
          category = category[ids[0]][0]['semanticType'];
          return ["biolink:" + category];
      } else {
          debug(noMatchMessage);
          this.logs.push(
            new LogEntry(
              'ERROR',
              null,
              noMatchMessage,
            ).getLog()
          );
          return [];
      }
    } else {
      try {
        let finalCategories = [];
        const tree = biolink.biolink._biolink_class_tree._objects_in_tree

        // get array of all unique categories for all curies
        const allCategories = [...Object.values(await id_resolver.resolveSRI({unknown: ids}))
          .map(curie => curie[0].semanticTypes)
          .filter(semanticTypes => !semanticTypes.every(item => item === null))
          .map(semanticTypes => semanticTypes.map(t => utils.removeBioLinkPrefix(t)))
          .reduce((set, arr) => new Set([...set, ...arr]), new Set())];

        if (allCategories.length) {
          finalCategories.push(allCategories[0]);
        } else {
          debug(noMatchMessage);
          this.logs.push(
            new LogEntry(
              'ERROR',
              null,
              noMatchMessage,
            ).getLog()
          );
          return [];
        }

        allCategories.forEach((cat, i) => {
          const keepSet = new Set();
          const rmSet = new Set();
          // check against each currently selected category
          finalCategories.forEach(selected => {
            if (tree[selected].is_mixin) { rmSet.add(selected) }
            if (tree[cat].is_mixin) { rmSet.add(cat) }
            if (cat === selected) { return keepSet.add(cat) }

            let parent = cat;
            while (parent) {
              if (selected === parent || tree[selected]._children.includes(parent)) {
                rmSet.add(selected);
                return keepSet.add(cat);
              }
              parent = tree[parent]._parent;
            }

            parent = selected;
            while (parent) {
              if (cat === parent || tree[cat]._children.includes(parent)) {
                rmSet.add(cat)
                return keepSet.add(selected);
              }
              parent = tree[parent]._parent;
            }
            // add both if neither is ancestor of the other
            keepSet.add(cat).add(selected);
          });
          finalCategories = [...keepSet].filter(cat => !rmSet.has(cat));
          // in event no categories are kept (due to mixin shenanigans/etc)
          if (!finalCategories.length && i < (allCategories.length - 1)) {
            finalCategories = [allCategories[i + 1]];
          }
        });
        if (!finalCategories.length) {
          debug(noMatchMessage);
          this.logs.push(
            new LogEntry(
              'ERROR',
              null,
              noMatchMessage,
            ).getLog()
          );
        }
        return [...finalCategories].map(cat => 'biolink:' + cat);
      } catch (error) {
          const errorMessage = `Unable to retrieve categories due to error ${error}`;
          debug(errorMessage);
          this.logs.push(
            new LogEntry(
              'ERROR',
              null,
              errorMessage,
            ).getLog()
          );
          return [];
        }
    }
  }

   /**
   * @private
   */
    async _storeNodes() {
      let nodes = {};
      for (let node_id in this.queryGraph.nodes) {
        //if node has ID but no categories
        if (
          (!Object.hasOwnProperty.call(this.queryGraph.nodes[node_id], 'categories') &&
          Object.hasOwnProperty.call(this.queryGraph.nodes[node_id], 'ids')) ||
          (Object.hasOwnProperty.call(this.queryGraph.nodes[node_id], 'categories') &&
          this.queryGraph.nodes[node_id].categories.length == 0 &&
          Object.hasOwnProperty.call(this.queryGraph.nodes[node_id], 'ids'))
          ) {
          let category = await this._findNodeCategories(this.queryGraph.nodes[node_id].ids);
          this.queryGraph.nodes[node_id].categories = category;
          debug(`Node category found. Assigning value: ${JSON.stringify(this.queryGraph.nodes[node_id])}`);
          this.logs.push(
            new LogEntry(
            'DEBUG',
            null,
            `Node (${node_id}) missing category. Assigned categor${category.length > 1 ? 'ies' : 'y'} [${category.join(', ')}] inferred from id${this.queryGraph.nodes[node_id].ids.length > 1 ? 's' : ''} [${this.queryGraph.nodes[node_id].ids.join(', ')}]`,
            // `Assigned missing node ID category: ${JSON.stringify(this.queryGraph.nodes[node_id])}`).getLog(),
            ).getLog()
          );
          nodes[node_id] = new QNode(node_id, this.queryGraph.nodes[node_id]);
        }else{
          debug(`Creating node...`);
          nodes[node_id] = new QNode(node_id, this.queryGraph.nodes[node_id]);
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
    for (let edge_id in this.queryGraph.edges) {
      let edge_info = {
        ...this.queryGraph.edges[edge_id],
        ...{
          subject: this.nodes[this.queryGraph.edges[edge_id].subject],
          object: this.nodes[this.queryGraph.edges[edge_id].object],
        },
      };
      //store in each node ids of edges connected to them
      this.nodes[this.queryGraph.edges[edge_id].subject].updateConnection(edge_id);
      this.nodes[this.queryGraph.edges[edge_id].object].updateConnection(edge_id);

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
    for (const edge_id in this.edges) {
      edges[edge_index] = [
        // () ----> ()
        this.edges[edge_id].object.curie ?
        new ExeEdge(this.edges[edge_id], true, undefined) :
        new ExeEdge(this.edges[edge_id], false, undefined)
        // reversed () <---- ()
      ];
      edge_index++;
    }
    return edges;
  }

};
