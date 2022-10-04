const QEdge = require('./query_edge');
const InvalidQueryGraphError = require('./exceptions/invalid_query_graph_error');
const LogEntry = require('./log_entry');
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

  _validateOneNodeID(queryGraph) {
    for (let nodeID in queryGraph.nodes) {
      if (queryGraph.nodes[nodeID] && queryGraph.nodes[nodeID]?.ids?.length > 0) {
        return;
      }
    }
    throw new InvalidQueryGraphError('body/message.query_graph.nodes should contain at least one node with at least one non-null id');
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

  _validateDuplicateEdges(queryGraph) {
    const edgeSet = new Set()
    for (const edgeID in queryGraph.edges) {
      const subject = queryGraph.edges[edgeID].subject
      const object = queryGraph.edges[edgeID].object
      if (edgeSet.has(`${subject}-${object}`) || edgeSet.has(`${object}-${subject}`)) {
        throw new InvalidQueryGraphError("Multiple edges between two nodes.");
      }
      edgeSet.add(`${subject}-${object}`)
    }
  }

  _validateCycles(queryGraph) {
    const nodes = {}
    for (const nodeID in queryGraph.nodes) {
      nodes[nodeID] = {
        connections: new Set(),
        visited: false
      };
    }
    
    for (const edgeID in queryGraph.edges) {
      const edge = queryGraph.edges[edgeID]
      nodes[edge.subject].connections.add(edge.object)
      nodes[edge.object].connections.add(edge.subject)
    }
      
    for (const firstNode in nodes) {
      if (nodes[firstNode].visited === true) continue;
      const stack = [{curNode: firstNode, parent: -1}]
      nodes[firstNode].visited = true
      while (stack.length !== 0) {
        const {curNode, parent} = stack.pop()
        for (const conNode of nodes[curNode].connections) {
          if (conNode == parent) continue;
          if (nodes[conNode].visited === true) {
            throw new InvalidQueryGraphError("The query graph contains a cycle.");
          }
          stack.push({curNode: conNode, parent: curNode})
          nodes[conNode].visited = true
        }
      }
    }
  }

  _validate(queryGraph) {
    this._validateEmptyEdges(queryGraph);
    this._validateEmptyNodes(queryGraph);
    this._validateOneNodeID(queryGraph);
    this._validateNodeEdgeCorrespondence(queryGraph);
    this._validateDuplicateEdges(queryGraph)
    this._validateCycles(queryGraph);
  }

  /**
   * @private
   */
  async _findNodeCategories(curies) {
    const noMatchMessage = `No category match found for ${JSON.stringify(curies)}.`;
    if (curies.length == 1) {
      let category = await id_resolver.resolveSRI({
          unknown: curies
      });
      debug(`Query node missing categories...Looking for match...`);
      if (Object.hasOwnProperty.call(category, curies[0]) && category[curies[0]][0]['semanticType']) {
          category = category[curies[0]][0]['semanticType'];
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
        const allCategories = [...Object.values(await id_resolver.resolveSRI({unknown: curies}))
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
      for (let qNodeID in this.queryGraph.nodes) {
        //if node has ID but no categories
        if (
          (!this.queryGraph.nodes[qNodeID].categories &&
          this.queryGraph.nodes[qNodeID].ids) ||
          (this.queryGraph.nodes[qNodeID].categories &&
          // this.queryGraph.nodes[qNodeID].categories.length == 0 &&
          this.queryGraph.nodes[qNodeID].ids)
          ) {
          let userAssignedCategories = this.queryGraph.nodes[qNodeID].categories;
          let categories = await this._findNodeCategories(this.queryGraph.nodes[qNodeID].ids)
          if (userAssignedCategories) {
            userAssignedCategories = [...userAssignedCategories]; // new Array for accurate logging after node updated
            categories = categories.filter((category) => !userAssignedCategories.includes(category));
          }
          if (categories.length) {
            if (!this.queryGraph.nodes[qNodeID].categories) {
              this.queryGraph.nodes[qNodeID].categories = categories;
            } else {
              this.queryGraph.nodes[qNodeID].categories.push(...categories);
            }
            debug(`Node categories found. Assigning value: ${JSON.stringify(this.queryGraph.nodes[qNodeID])}`);
            this.logs.push(
              new LogEntry(
                'INFO',
                null,
                [
                  `Node ${qNodeID} `,
                  `with id${this.queryGraph.nodes[qNodeID].ids.length > 1 ? 's' : ''} `,
                  `[${this.queryGraph.nodes[qNodeID].ids.join(', ')}] `,
                  `${
                    userAssignedCategories && userAssignedCategories.length
                    ? `and categor${userAssignedCategories.length === 1 ? 'y' : 'ies'} [${userAssignedCategories.join(', ')}] augmented with`
                    : `assigned`
                  } `,
                  `categor${categories.length > 1 ? 'ies' : 'y'} `,
                  `[${categories.join(', ')}] inferred from `,
                  `id${this.queryGraph.nodes[qNodeID].ids.length > 1 ? 's' : ''}.`,
                ].join('')
              ).getLog(),
            );
          }
          nodes[qNodeID] = new QNode(qNodeID, this.queryGraph.nodes[qNodeID]);
        } else {
          debug(`Creating node...`);
          nodes[qNodeID] = new QNode(qNodeID, this.queryGraph.nodes[qNodeID]);
        }
        
        if (nodes[qNodeID].category !== undefined) {
          if (nodes[qNodeID].category.includes('biolink:Disease') || nodes[qNodeID].category.includes('biolink:PhenotypicFeature')) {
            nodes[qNodeID].category = nodes[qNodeID].category.filter(e => e !== 'biolink:Disease' && e !== 'biolink:PhenotypicFeature')
            nodes[qNodeID].category.push('biolink:DiseaseOrPhenotypicFeature')
          }
          if (nodes[qNodeID].category.includes('biolink:Protein') && !nodes[qNodeID].category.includes('biolink:Gene')) {
            nodes[qNodeID].category.push('biolink:Gene');
          }
        }
      }
      this.logs.push(
        new LogEntry('DEBUG', null, `BTE identified ${Object.keys(nodes).length} qNodes from your query graph`).getLog(),
      );
      return nodes;
    }

  /**
   *
   */
  async calculateEdges() {
    this._validate(this.queryGraph);
    //populate edge and node info
    debug(`(1) Creating edges for manager...`);
    if (this.nodes === undefined) {
      this.nodes = await this._storeNodes();
    }

    let edges = {};
    let edge_index = 0;
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

      edges[edge_index] = [edge_info.object.curie ? 
        new QEdge(qEdgeID, edge_info, true) :
        new QEdge(qEdgeID, edge_info, false)];
      edge_index++;
    }
    this.logs.push(
      new LogEntry('DEBUG', null, `BTE identified ${Object.keys(edges).length} qEdges from your query graph`).getLog(),
    );
    return edges;
  }

};
