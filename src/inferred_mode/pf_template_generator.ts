import path from "path";
import fs from "fs/promises";
import yaml2json from "js-yaml";
import biolink from "../biolink";
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

export default async function generateTemplates(sub: TrapiQNode, un: TrapiQNode, obj: TrapiQNode) {
  // load tables
  if (!tablesLoaded) {
    if (!loadTablesPromise) {
      loadTablesPromise = loadTables();
    }
    await loadTablesPromise;
  }

  const templateA: TrapiQueryGraph[] = [];
  const templateB: TrapiQueryGraph[] = [];
  const templateC: TrapiQueryGraph[] = [];
  for (const subCat of sub.categories) {
    for (const objCat of obj.categories) {
      const unCats = un.categories ? un.categories : (categoryTable[subCat]?.[objCat]?.map(x => 'biolink:'+x) ?? []);
      for (const unCat of unCats) {
        // template A
        templateA.push({
          nodes: {
            creativeQuerySubject: {...sub, categories: [subCat]},
            creativeQueryObject: {...obj, categories: [objCat]},
            un: {...un, categories: [unCat]}
          },
          edges: {
            sub_un: {
              subject: 'creativeQuerySubject',
              object: 'un',
              predicates: predicateTable[subCat]?.[unCat]?.map(x => 'biolink:'+x.predicate) ?? []
            },
            un_obj: {
              subject: 'un',
              object: 'creativeQueryObject',
              predicates: predicateTable[unCat]?.[objCat]?.map(x => 'biolink:'+x.predicate) ?? []
            }
          }
        });

        // template B
        for (const bCat of categoryTable[unCat]?.[objCat] ?? []) {
          templateB.push({
            nodes: {
              creativeQuerySubject: {...sub, categories: [subCat]},
              creativeQueryObject: {...obj, categories: [objCat]},
              un: {...un, categories: [unCat]},
              nb: { categories: [bCat] }
            },
            edges: {
              sub_un: {
                subject: 'creativeQuerySubject',
                object: 'un',
                predicates: predicateTable[subCat]?.[unCat]?.map(x => 'biolink:'+x.predicate) ?? []
              },
              un_b: {
                subject: 'un',
                object: 'nb',
                predicates: predicateTable[unCat]?.[bCat]?.map(x => 'biolink:'+x.predicate) ?? []
              },
              b_obj: {
                subject: 'nb',
                object: 'creativeQueryObject',
                predicates: predicateTable[bCat]?.[objCat]?.map(x => 'biolink:'+x.predicate) ?? []
              }
            }
          });
        }

        // template C
        for (const cCat of categoryTable[unCat]?.[objCat] ?? []) {
          templateC.push({
            nodes: {
              creativeQuerySubject: {...sub, categories: [subCat]},
              creativeQueryObject: {...obj, categories: [objCat]},
              un: {...un, categories: [unCat]},
              nc: { categories: [cCat] }
            },
            edges: {
              sub_c: {
                subject: 'creativeQuerySubject',
                object: 'nc',
                predicates: predicateTable[subCat]?.[cCat]?.map(x => 'biolink:'+x.predicate) ?? []
              },
              c_un: {
                subject: 'nc',
                object: 'un',
                predicates: predicateTable[cCat]?.[unCat]?.map(x => 'biolink:'+x.predicate) ?? []
              },
              un_obj: {
                subject: 'un',
                object: 'creativeQueryObject',
                predicates: predicateTable[unCat]?.[objCat]?.map(x => 'biolink:'+x.predicate) ?? []
              }
            }
          });
        }
      }
    }
  }

  return [...templateA, ...templateB, ...templateC];
}