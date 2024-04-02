import TRAPIQueryHandler, { QueryHandlerOptions } from '../index';
import { TrapiResponse, TrapiQEdge, TrapiResult, TrapiQueryGraph, TrapiQNode, TrapiAnalysis } from '../types';
import InferredQueryHandler from './inferred_mode';
import { scaled_sigmoid, inverse_scaled_sigmoid } from '../results_assembly/score';
import { LogEntry, StampedLog, Telemetry } from '@biothings-explorer/utils';
import Debug from 'debug';
const debug = Debug('bte:biothings-explorer-trapi:pathfinder');

interface ResultAuxObject {
  results: ResultObject;
  graphs: AuxGraphObject;
}

interface ResultObject {
  [id: string]: TrapiResult
}

interface AuxGraphObject {
  [id: string]: { edges: Set<string> }
}

interface DfsGraph {
  [node: string]: { [dst: string]: string[] }
}

export default class PathfinderQueryHandler {
  logs: StampedLog[];
  CREATIVE_LIMIT: number;
  options: QueryHandlerOptions;
  queryGraph: TrapiQueryGraph;
  parent: TRAPIQueryHandler;

  // assigned internally
  unpinnedNodeId: string;
  unpinnedNode: TrapiQNode;
  intermediateEdges: [string, TrapiQEdge][];
  mainEdgeId: string;
  mainEdge: TrapiQEdge;
  originalAnalyses: { [id: string]: TrapiAnalysis };

  constructor(logs: StampedLog[], queryGraph: TrapiQueryGraph, parent: TRAPIQueryHandler) {
    this.logs = logs;
    this.options = parent.options;
    this.parent = parent;
    this.queryGraph = queryGraph;
    this.CREATIVE_LIMIT = process.env.CREATIVE_LIMIT ? parseInt(process.env.CREATIVE_LIMIT) : 500;
  }

  async query() {
    // add log for PF mode
    this.logs.push(new LogEntry('INFO', null, 'Proceeding in Pathfinder mode.').getLog());
    debug('Proceeding in Pathfinder mode');

    const err = this.extractData();

    if (typeof err === 'string') {
        debug(err);
        this.logs.push(new LogEntry('WARNING', null, err).getLog());
        return;
    }

    // remove unpinned node & all edges involving unpinned node for now
    delete this.queryGraph.nodes[this.unpinnedNodeId];

    // remove intermediates for creative execution
    this.intermediateEdges.forEach(([edgeId, _]) => delete this.queryGraph.edges[edgeId]);

    // run creative mode
    const inferredQueryHandler = new InferredQueryHandler(
      this.parent,
      this.queryGraph,
      this.logs,
      this.options,
      this.parent.path,
      this.parent.predicatePath,
      this.parent.includeReasoner,
      true
    );
    const creativeResponse = await inferredQueryHandler.query();

    // restore query graph
    this.queryGraph.nodes[this.unpinnedNodeId] = this.unpinnedNode;
    this.intermediateEdges.forEach(([edgeId, edge]) => this.queryGraph.edges[edgeId] = edge);
    creativeResponse.message.query_graph = this.queryGraph;

    this.parse(creativeResponse);

    // logs
    creativeResponse.logs = this.logs.map(log => log.toJSON());

    return creativeResponse;
  }

  // extracts info from query into variables that are used by pathfinder
  // returns string if an error occurred
  extractData(): undefined | string {
    [this.unpinnedNodeId, this.unpinnedNode] = Object.entries(this.queryGraph.nodes).find(([_, node]) => !node.ids);

    this.intermediateEdges = Object.entries(this.queryGraph.edges).filter(([_, edge]) => edge.subject === this.unpinnedNodeId || edge.object === this.unpinnedNodeId);
    [this.mainEdgeId, this.mainEdge] = Object.entries(this.queryGraph.edges).find(([_, edge]) => edge.subject !== this.unpinnedNodeId && edge.object !== this.unpinnedNodeId);

    // intermediateEdges should be in order of n0 -> un & un -> n1
    if (this.intermediateEdges[0][1].subject === this.unpinnedNodeId) {
      let temp = this.intermediateEdges[0];
      this.intermediateEdges[0] = this.intermediateEdges[1];
      this.intermediateEdges[1] = temp;
    }
  
    if (this.intermediateEdges[0][1].subject !== this.mainEdge.subject || this.intermediateEdges[1][1].object !== this.mainEdge.object || this.intermediateEdges[0][1].object !== this.unpinnedNodeId || this.intermediateEdges[1][1].subject !== this.unpinnedNodeId) {
      return 'Intermediate edges for Pathfinder are incorrect. Should follow pinned node -> unpinned node -> pinned node. Your query terminates.';
    }
  }


  parse(creativeResponse: TrapiResponse) {
    const span = Telemetry.startSpan({ description: 'pathfinderParse' });

    this.originalAnalyses = (creativeResponse as any).original_analyses;
    delete (creativeResponse as any).original_analyses;

    // if no results then we are done
    if (creativeResponse.message.results.length === 0) {
      return creativeResponse;
    }

    // set up a graph structure
    const kgEdge = creativeResponse.message.results[0].analyses[0].edge_bindings[this.mainEdgeId][0].id;
    const kgSrc = creativeResponse.message.results[0].node_bindings[this.mainEdge.subject][0].id;
    const kgDst = creativeResponse.message.results[0].node_bindings[this.mainEdge.object][0].id;
    const dfsGraph: DfsGraph = {};
    const supportGraphsPerNode: { [node: string]: Set<string> } = {};
    const supportGraphs = (creativeResponse.message.knowledge_graph.edges[kgEdge]?.attributes?.find(attr => attr.attribute_type_id === 'biolink:support_graphs')?.value ?? []) as string[];
    for (const supportGraph of supportGraphs) {
      const auxGraph = (creativeResponse.message.auxiliary_graphs ?? {})[supportGraph];
      for (const subEdge of auxGraph.edges) {
        const kgSubEdge = creativeResponse.message.knowledge_graph.edges[subEdge];
        if (!dfsGraph[kgSubEdge.subject]) {
          dfsGraph[kgSubEdge.subject] = {};
        }
        if (!dfsGraph[kgSubEdge.subject][kgSubEdge.object]) {
          dfsGraph[kgSubEdge.subject][kgSubEdge.object] = [];
        }
        dfsGraph[kgSubEdge.subject][kgSubEdge.object].push(subEdge);

        if (!supportGraphsPerNode[kgSubEdge.subject]) {
          supportGraphsPerNode[kgSubEdge.subject] = new Set();
        }
        supportGraphsPerNode[kgSubEdge.subject].add(supportGraph);
      }
    }

    const message1 = '[Pathfinder]: Performing search for intermediate nodes.';
    debug(message1);
    this.logs.push(new LogEntry('INFO', null, message1).getLog());

    const { results: newResultObject, graphs: newAuxGraphs } = this._searchForIntermediates(creativeResponse, dfsGraph, supportGraphsPerNode, kgSrc, kgDst, kgEdge);

    creativeResponse.message.results = Object.values(newResultObject).sort((a, b) => (b.analyses[0].score ?? 0) - (a.analyses[0].score ?? 0)).slice(0, this.CREATIVE_LIMIT);
    creativeResponse.description = `Query processed successfully, retrieved ${creativeResponse.message.results.length} results.`

    const finalNewAuxGraphs: { [id: string]: { edges: string[] } } = newAuxGraphs as any;
    for (const auxGraph in finalNewAuxGraphs) {
      finalNewAuxGraphs[auxGraph].edges = Array.from(finalNewAuxGraphs[auxGraph].edges);
    }
    Object.assign(creativeResponse.message.auxiliary_graphs!, finalNewAuxGraphs);

    const message2 = `[Pathfinder]: Pathfinder found ${creativeResponse.message.results.length} intermediate nodes and created ${Object.keys(finalNewAuxGraphs).length} support graphs.`;
    debug(message2);
    this.logs.push(new LogEntry('INFO', null, message2).getLog());

    span.finish();

    return creativeResponse;
  }

  _searchForIntermediates(creativeResponse: TrapiResponse, dfsGraph: DfsGraph, supportGraphsPerNode: { [node: string]: Set<string> }, kgSrc: string, kgDst: string, kgEdge: string): ResultAuxObject {
    const span = Telemetry.startSpan({ description: 'pathfinderIntermediateSearch' });

    // perform dfs
    const stack = [{ node: kgSrc, path: [kgSrc] }];
    const newResultObject: ResultObject = {};
    const newAuxGraphs: AuxGraphObject = {};
    while (stack.length !== 0) {
      const { node, path } = stack.pop()!;

      // continue creating path if we haven't reached end yet
      if (node !== kgDst) {
        for (const neighbor in dfsGraph[node]) {
          if (!path.includes(neighbor)) {
            stack.push({ node: neighbor, path: [...path, neighbor] });
          }
        }
        continue;
      }

      // path to dest too short
      if (path.length <= 2) {
        continue;
      }

      // loop through all intermediate nodes in path to dest
      for (let i = 1; i < path.length - 1; i++) {
        const intermediateNode = path[i];
        const firstEdges: string[] = [];
        const secondEdges: string[] = [];
        for (let j = 0; j < i; j++) {
          firstEdges.push.apply(firstEdges, dfsGraph[path[j]][path[j+1]]);
        }
        for (let j = i; j < path.length - 1; j++) {
          secondEdges.push.apply(firstEdges, dfsGraph[path[j]][path[j+1]]);
        }

        if (`pathfinder-${kgSrc}-${intermediateNode}-${kgDst}` in newResultObject) {
          firstEdges.forEach(edge => newAuxGraphs[`pathfinder-${kgSrc}-${intermediateNode}-support`].edges.add(edge));
          secondEdges.forEach(edge => newAuxGraphs[`pathfinder-${intermediateNode}-${kgDst}-support`].edges.add(edge));
          continue;
        }

        // create new edges & aux graph
        newResultObject[`pathfinder-${kgSrc}-${intermediateNode}-${kgDst}`] = {
          node_bindings: {
            [this.mainEdge.subject]: [{ id: kgSrc }],
            [this.mainEdge.object]: [{ id: kgDst }],
            [this.unpinnedNodeId]: [{ id: intermediateNode }]
          },
          analyses: [{
            resource_id: "infores:biothings-explorer",
            edge_bindings: {
              [this.mainEdgeId]: [{ id: kgEdge }],
              [this.intermediateEdges[0][0]]: [{ id: `pathfinder-${kgSrc}-${intermediateNode}` }],
              [this.intermediateEdges[1][0]]: [{ id: `pathfinder-${intermediateNode}-${kgDst}` }],
            },
            score: undefined
          }],
        };
        creativeResponse.message.knowledge_graph.edges[`pathfinder-${kgSrc}-${intermediateNode}`] = {
          predicate: 'biolink:related_to',
          subject: kgSrc,
          object: intermediateNode,
          sources: [
            {
              resource_id: this.options.provenanceUsesServiceProvider
                ? 'infores:service-provider-trapi'
                : 'infores:biothings-explorer',
              resource_role: 'primary_knowledge_source',
            },
          ],
          attributes: [{ attribute_type_id: 'biolink:support_graphs', value: [`pathfinder-${kgSrc}-${intermediateNode}-support`] }],
        };
        creativeResponse.message.knowledge_graph.edges[`pathfinder-${intermediateNode}-${kgDst}`] = {
          predicate: 'biolink:related_to',
          subject: intermediateNode,
          object: kgDst,
          sources: [
            {
              resource_id: this.options.provenanceUsesServiceProvider
                ? 'infores:service-provider-trapi'
                : 'infores:biothings-explorer',
              resource_role: 'primary_knowledge_source',
            },
          ],
          attributes: [{ attribute_type_id: 'biolink:support_graphs', value: [`pathfinder-${intermediateNode}-${kgDst}-support`] }],
        };
        newAuxGraphs[`pathfinder-${kgSrc}-${intermediateNode}-support`] = { edges: new Set(firstEdges) };
        newAuxGraphs[`pathfinder-${intermediateNode}-${kgDst}-support`] = { edges: new Set(secondEdges) };

        // calculate score
        if (supportGraphsPerNode[intermediateNode]?.size > 0) {
          let score: number | undefined = undefined;
          for (const supportGraph of supportGraphsPerNode[intermediateNode]) {
            score = scaled_sigmoid(
              inverse_scaled_sigmoid(score ?? 0) +
              inverse_scaled_sigmoid(this.originalAnalyses[supportGraph].score),
            );
          }
          newResultObject[`pathfinder-${kgSrc}-${intermediateNode}-${kgDst}`].analyses[0].score = score;
        }
      }
    }

    span.finish();

    return { results: newResultObject, graphs: newAuxGraphs };
  }
}