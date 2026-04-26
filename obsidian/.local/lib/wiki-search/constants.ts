import { WIKI_DIR } from "../wiki-core/constants.ts";

export { WIKI_DIR };
export const RERANK_MODEL = "cohere/rerank-4-fast";
export const RERANK_URL = "https://openrouter.ai/api/v1/rerank";
export const EMBED_URL = "https://openrouter.ai/api/v1/embeddings";
export const EMBED_MODEL = "qwen/qwen3-embedding-8b";
export const EMBED_DIMS = 4096;

export const MAX_CONTENT_CHARS = 500;
export const BM25_K1 = 1.5;
export const BM25_B = 0.75;
