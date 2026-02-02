# Skill: Semantic Search in Files 🔎

## Purpose
Search across selected files using keywords + semantic ranking. Returns precise citations with file location, quote, and confidence score.

## When to Use
- User asks "find where X is mentioned"
- User searches for concept: "where does it explain photosynthesis?"
- User wants definition: "what is the definition of X?"

## Input Contract
- `query`: string (required)
- `fileIds`: string[] (optional, default: all indexed files)
- `selection`: SelectionContext (optional, if provided → search within selection only)
- `maxResults`: number (optional, default: 5)

## Workflow

### Step 1: Parse query
- Extract keywords
- Identify intent (definition? explanation? example?)

### Step 2: Keyword search (fast pass)
- Search file chunks for exact keyword matches
- Rank by TF-IDF (term frequency)
- Keep top 20 candidates

### Step 3: Semantic search (concept-level)
- If embeddings available → compute query embedding
- Find closest chunks by cosine similarity
- Merge with keyword results

### Step 4: Rank and deduplicate
- Combine keyword + semantic scores
- Remove duplicates (same file, same page)
- Rank by relevance

### Step 5: Extract citations
For each result:
- Get file metadata (name, type)
- Get location (page, section, line number)
- Extract quote (highlight matching text)
- Compute confidence score (0-1)

### Step 6: Format output
Return structured citations:
```json
{
  "query": "...",
  "results": [
    {
      "file_id": "uuid",
      "file_name": "lecture_3.pdf",
      "location": "page:5",
      "quote": "Photosynthesis is the process...",
      "confidence": 0.92,
      "context": "Previous sentence... [quote] ...Next sentence"
    }
  ]
}
```

## Output Contract
Must include:
- `file_id`, `file_name`, `location`, `quote`, `confidence`
- Results sorted by confidence (descending)

## Atomic Tools Used
- `fileIO.getFileChunks(fileId)`
- `extract.keywordSearch(chunks, keywords)`
- `extract.semanticSearch(chunks, queryEmbedding)` (future)
- `transform.rankResults(candidates)`
- `transform.extractQuote(chunk, keywords)`

## Verification Rules
- All results must have `confidence >= 0.5`
- Quote must contain at least one search keyword (or close match)
- Location must be valid (page exists, section exists)

## Error Handling
- If no files indexed → return error "Please index files first"
- If no results found → return empty array with suggestion
- If query too vague → ask user to be more specific

## Estimated Tokens
~2000 tokens (query parsing + ranking)

## Example Usage
**User**: "find where it mentions mitochondria"
**Output**:
```json
{
  "query": "mitochondria",
  "results": [
    {
      "file_id": "file-123",
      "file_name": "biology_notes.pdf",
      "location": "page:12",
      "quote": "Mitochondria are the powerhouse of the cell...",
      "confidence": 0.95
    }
  ]
}
```
