/* eslint-disable @typescript-eslint/no-var-requires */
import { promises as fs } from 'fs';
import path from 'path';
import async from 'async';
import { TrapiQueryGraph } from '@biothings-explorer/types';
import { CompactQualifiers } from '../types';

export interface TemplateLookup {
  subject: string;
  object: string;
  predicate: string;
  qualifiers: CompactQualifiers;
}

export interface MatchedTemplate {
  template: string;
  queryGraph: TrapiQueryGraph;
  qualifiers: CompactQualifiers;
}

export interface TemplateGroup {
  name: string;
  subject: string[];
  predicate: string[];
  object: string[];
  qualifiers?: CompactQualifiers;
  templates: string[];
  pathfinder: boolean;
}

export interface CompactEdge {
  subject: string;
  predicate: string;
  object: string;
  qualifiers: CompactQualifiers;
}

interface PathMatch {
  path: string;
  qualifiers: CompactQualifiers;
}

export async function getTemplates(lookups: TemplateLookup[], pathfinder = false): Promise<MatchedTemplate[]> {
  async function getFiles(dir: string): Promise<string[]> {
    const rootFiles = await fs.readdir(path.resolve(dir));
    return await async.reduce(rootFiles, [] as string[], async (arr, fname: string) => {
      const fPath = path.join(dir, fname);
      if ((await fs.lstat(fPath)).isDirectory()) {
        return [...arr, ...(await getFiles(fPath))];
      }
      return [...arr, fPath];
    });
  }
  const templatePathsOnly = await getFiles(path.resolve(__dirname, '../../data/templates'));
  const templatePaths: { [fileBaseName: string]: string } = Object.fromEntries(
    templatePathsOnly.map((templatePath: string) => {
      return [path.basename(templatePath), templatePath];
    }),
  );
  const templateGroups = JSON.parse(
    await fs.readFile(path.resolve(__dirname, '../../data/templateGroups.json'), { encoding: 'utf8' }),
  );
  const matchingTemplatePaths: PathMatch[] = templateGroups.reduce((matches: PathMatch[], group: TemplateGroup) => {
    let matchingQualifiers: CompactQualifiers;
    const lookupMatch = lookups.some((lookup) => {
      const match =
        !!group.pathfinder === pathfinder &&
        group.subject.includes(lookup.subject) &&
        group.object.includes(lookup.object) &&
        group.predicate.includes(lookup.predicate) &&
        Object.entries(lookup.qualifiers || {}).every(([qualifierType, qualifierValue]) => {
          return (
            (group.qualifiers || {})[qualifierType.replace('biolink:', '')] &&
            group.qualifiers[qualifierType.replace('biolink:', '')] === qualifierValue.replace('biolink:', '')
          );
        });
      if (match) matchingQualifiers = lookup.qualifiers;
      return match;
    });

    if (lookupMatch) {
      group.templates.forEach((template) => {
        if (!matches.find((t) => t.path === templatePaths[template])) {
          matches.push({ path: templatePaths[template], qualifiers: matchingQualifiers });
        }
      });
    }
    return matches;
  }, [] as string[]);
  return await async.map(matchingTemplatePaths, async (templatePathObj: PathMatch) => {
    return {
      template: templatePathObj.path.substring(templatePathObj.path.lastIndexOf('/') + 1),
      queryGraph: JSON.parse(await fs.readFile(templatePathObj.path, { encoding: 'utf8' })).message.query_graph,
      qualifiers: templatePathObj.qualifiers,
    };
  });
}

export async function supportedLookups(): Promise<CompactEdge[]> {
  const edges: Set<CompactEdge> = new Set();
  const templateGroups = JSON.parse(
    await fs.readFile(path.resolve(__dirname, '../../data/templateGroups.json'), { encoding: 'utf8' }),
  );
  templateGroups.forEach((group: TemplateGroup) => {
    group.subject.forEach((subject) => {
      group.predicate.forEach((predicate) => {
        group.object.forEach((object) => {
          edges.add({
            subject: `biolink:${subject}`,
            predicate: `biolink:${predicate}`,
            object: `biolink:${object}`,
            qualifiers: group.qualifiers,
          });
        });
      });
    });
  });
  return [...edges];
}
