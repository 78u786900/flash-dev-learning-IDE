/**
 * Gemini text embedding API for semantic search.
 * Uses gemini-embedding-001 with RETRIEVAL_QUERY (query) and RETRIEVAL_DOCUMENT (chunks).
 */

const EMBED_MODEL = 'gemini-embedding-001'
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`
const MAX_CHARS = 7500 // ~2048 tokens

function truncate(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length <= MAX_CHARS ? t : t.slice(0, MAX_CHARS) + '…'
}

async function embedOne(apiKey: string, text: string, taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
  const res = await fetch(`${EMBED_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text: truncate(text) }] },
      taskType,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Embed API ${res.status}`)
  }
  const data = (await res.json()) as { embedding?: { values?: number[] } }
  const values = data?.embedding?.values
  if (!Array.isArray(values)) throw new Error('Invalid embed response')
  return values
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const den = Math.sqrt(na) * Math.sqrt(nb)
  return den === 0 ? 0 : dot / den
}

/**
 * Embed query + documents and return similarity score per document (0–1 range).
 * Uses RETRIEVAL_QUERY for query and RETRIEVAL_DOCUMENT for each document.
 */
export async function embedForSearch(apiKey: string, query: string, documents: string[]): Promise<number[]> {
  if (!documents.length) return []
  const [queryVec, ...docVecs] = await Promise.all([
    embedOne(apiKey, query, 'RETRIEVAL_QUERY'),
    ...documents.map(d => embedOne(apiKey, d, 'RETRIEVAL_DOCUMENT')),
  ])
  return docVecs.map(doc => cosineSimilarity(queryVec, doc))
}
