/**
 * Keyword-based search (fast pass)
 */
export function keywordSearch(
  chunks: Array<{ content: string; metadata: any }>,
  keywords: string[]
): Array<{ chunk: any; score: number }> {
  const results = []
  
  for (const chunk of chunks) {
    let score = 0
    const content = chunk.content.toLowerCase()
    
    for (const keyword of keywords) {
      const count = (content.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length
      score += count
    }
    
    if (score > 0) {
      results.push({ chunk, score })
    }
  }
  
  return results.sort((a, b) => b.score - a.score)
}

/**
 * Extract quote with context
 */
export function extractQuote(
  content: string,
  keywords: string[],
  maxLength: number = 200
): { quote: string; context: string } {
  const lower = content.toLowerCase()
  
  // Find first keyword occurrence
  let index = -1
  for (const kw of keywords) {
    const i = lower.indexOf(kw.toLowerCase())
    if (i >= 0 && (index < 0 || i < index)) {
      index = i
    }
  }
  
  if (index < 0) {
    return { quote: content.slice(0, maxLength), context: content }
  }
  
  // Extract sentence containing keyword
  const sentences = content.split(/[.!?]+/)
  let targetSentence = ''
  let sentenceIndex = 0
  let charCount = 0
  
  for (let i = 0; i < sentences.length; i++) {
    charCount += sentences[i].length
    if (charCount > index) {
      targetSentence = sentences[i].trim()
      sentenceIndex = i
      break
    }
  }
  
  // Context: ±2 sentences
  const contextSentences = sentences.slice(
    Math.max(0, sentenceIndex - 2),
    Math.min(sentences.length, sentenceIndex + 3)
  )
  
  return {
    quote: targetSentence.slice(0, maxLength),
    context: contextSentences.join('. ')
  }
}

/**
 * Calculate TF-IDF score
 */
export function calculateTFIDF(
  term: string,
  document: string,
  corpus: string[]
): number {
  const termFreq = (document.match(new RegExp(term, 'gi')) || []).length
  const docFreq = corpus.filter(doc => doc.toLowerCase().includes(term.toLowerCase())).length
  
  const tf = termFreq / document.split(/\s+/).length
  const idf = Math.log(corpus.length / (docFreq + 1))
  
  return tf * idf
}
