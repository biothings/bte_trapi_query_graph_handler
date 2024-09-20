import path from "path";
import fs from "fs/promises";
import yaml2json from "js-yaml";
import { biolink } from '@biothings-explorer/utils';
import { TrapiQNode, TrapiQueryGraph } from "@biothings-explorer/types";

interface CategoryTable {
  [category1: string]: { [category2: string]: string[] };
}

interface PredicateTable {
  [category1: string]: { [category2: string]: { predicate: string }[] };
}

let categoryTable: CategoryTable;
let predicateTable: PredicateTable;
let loadTablesPromise: Promise<void>;
let tablesLoaded = false;

async function loadTables() {
  const categoryTablePath = path.resolve(__dirname, '../../data/categoryTable.yaml');
  const predicateTablePath = path.resolve(__dirname, '../../data/predicateTable.yaml');
  categoryTable = yaml2json.load(await fs.readFile(categoryTablePath, { encoding: 'utf8' }));
  predicateTable = yaml2json.load(await fs.readFile(predicateTablePath, { encoding: 'utf8' }));

  // descendent categories
  for (const table of [categoryTable, predicateTable]) {
    for (const category1 in table) {
      for (const category2 in table[category1]) {
        for (const descendant1 of biolink.getDescendantClasses(category1)) {
          for (const descendant2 of biolink.getDescendantClasses(category2)) {
            if (table?.['biolink:'+descendant1]?.['biolink:'+descendant2] !== undefined) continue;

            if (!('biolink:'+descendant1 in table)) {
              table['biolink:'+descendant1] = {};
            }
            table['biolink:'+descendant1]['biolink:'+descendant2] = table[category1][category2];
          }
        }
      }
    }
  }

  tablesLoaded = true;
}

export default async function generateTemplates(sub: TrapiQNode, un: TrapiQNode, obj: TrapiQNode): Promise<TrapiQueryGraph[]> {
  // load tables
  if (!tablesLoaded) {
    if (!loadTablesPromise) {
      loadTablesPromise = loadTables();
    }
    await loadTablesPromise;
  }

  const templateA = {
    nodes: {
      creativeQuerySubject: sub,
      creativeQueryObject: obj,
      un: {...un, categories: new Set<string>() }
    },
    edges: {
      sub_un: {
        subject: 'creativeQuerySubject',
        object: 'un',
        predicates: new Set<string>(), 
      },
      un_obj: {
        subject: 'un',
        object: 'creativeQueryObject',
        predicates: new Set<string>(),
      }
    }
  };
  const templateB = {
    nodes: {
      creativeQuerySubject: sub,
      creativeQueryObject: obj,
      un: {...un, categories: new Set<string>() },
      nb: { categories: new Set<string>() }
    },
    edges: {
      sub_un: {
        subject: 'creativeQuerySubject',
        object: 'un',
        predicates: new Set<string>()
      },
      un_b: {
        subject: 'un',
        object: 'nb',
        predicates: new Set<string>()
      },
      b_obj: {
        subject: 'nb',
        object: 'creativeQueryObject',
        predicates: new Set<string>()
      }
    }
  };
  const templateC = {
    nodes: {
      creativeQuerySubject: sub,
      creativeQueryObject: obj,
      un: {...un, categories: new Set<string>()},
      nc: { categories: new Set<string>() }
    },
    edges: {
      sub_c: {
        subject: 'creativeQuerySubject',
        object: 'nc',
        predicates: new Set<string>()
      },
      c_un: {
        subject: 'nc',
        object: 'un',
        predicates: new Set<string>()
      },
      un_obj: {
        subject: 'un',
        object: 'creativeQueryObject',
        predicates: new Set<string>()
      }
    }
  };
  for (const subCat of sub.categories) {
    for (const objCat of obj.categories) {
      const unCats = (un.categories && !un.categories.includes("biolink:NamedThing")) ? un.categories : (categoryTable[subCat]?.[objCat]?.map(x => 'biolink:'+x) ?? []);
      for (const unCat of unCats) {
        // template A
        templateA.nodes.un.categories.add(unCat);
        predicateTable[subCat]?.[unCat]?.forEach(x => templateA.edges.sub_un.predicates.add('biolink:'+x));
        predicateTable[unCat]?.[objCat]?.forEach(x => templateA.edges.un_obj.predicates.add('biolink:'+x));

        // template B
        templateB.nodes.un.categories.add(unCat);
        for (let bCat of categoryTable[unCat]?.[objCat] ?? []) {
          bCat = 'biolink:'+bCat;
          templateB.nodes.nb.categories.add(bCat);
          predicateTable[subCat]?.[unCat]?.forEach(x => templateB.edges.sub_un.predicates.add('biolink:'+x));
          predicateTable[unCat]?.[bCat]?.forEach(x => templateB.edges.un_b.predicates.add('biolink:'+x));
          predicateTable[bCat]?.[objCat]?.forEach(x => templateB.edges.b_obj.predicates.add('biolink:'+x));
        }

        // template C
        templateC.nodes.un.categories.add(unCat);
        for (let cCat of categoryTable[subCat]?.[unCat] ?? []) {
          cCat = 'biolink:'+cCat;
          templateC.nodes.nc.categories.add(cCat);
          predicateTable[subCat]?.[cCat]?.forEach(x => templateC.edges.sub_c.predicates.add('biolink:'+x));
          predicateTable[cCat]?.[unCat]?.forEach(x => templateC.edges.c_un.predicates.add('biolink:'+x));
          predicateTable[unCat]?.[objCat]?.forEach(x => templateC.edges.un_obj.predicates.add('biolink:'+x));
        }
      }
    }
  }

  const queryGraphs: TrapiQueryGraph[] = [];
  for (const template of [templateA, templateB, templateC]) {
    const queryGraph: TrapiQueryGraph = { nodes: {}, edges: {} };
    for (const node in template.nodes) {
      queryGraph.nodes[node] = {
        ...template.nodes[node],
        ...(template.nodes[node].categories && { categories: Array.from(template.nodes[node].categories) })
      };
    }
    for (const edge in template.edges) {
      queryGraph.edges[edge] = {
        ...template.edges[edge],
        predicates: Array.from(template.edges[edge].predicates)
      };
      if (queryGraph.edges[edge].predicates.length === 0) {
        delete queryGraph.edges[edge].predicates;
      }
    }
    queryGraphs.push(queryGraph);
  }
  return queryGraphs;
}