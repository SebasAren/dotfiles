export interface Bm25Doc {
  id: string;
  terms: string[];
  tf: Record<string, number>;
  len: number;
}

export interface Bm25Index {
  docs: Bm25Doc[];
  avgdl: number;
  idf: Record<string, number>;
  N: number;
}

export interface ManifestEntry {
  hash: string;
}

export type Manifest = Record<string, ManifestEntry>;
