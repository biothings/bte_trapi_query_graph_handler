import { TrapiLog } from '@biothings-explorer/utils';

export interface UnavailableAPITracker {
  [server: string]: { skip: boolean; skippedQueries: number };
}

export interface CompactQualifiers {
  [qualifier_type_id: string]: string;
}

export interface SubclassEdges {
  [expandedID: string]: {
    [parentID: string]: {
      source: string;
      qNodes: string[];
    };
  };
}
