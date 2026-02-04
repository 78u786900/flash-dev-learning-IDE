import type { TranscriptSegment } from '../types'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const i = result.indexOf(',')
      resolve(i >= 0 ? result.slice(i + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read audio blob'))
    reader.readAsDataURL(blob)
  })
}

/** Call Gemini Flash with audio to obtain language + timestamped transcript segments. */
export async function transcribeWithGeminiFlash(
  blob: Blob
): Promise<{ language: string; segments: TranscriptSegment[] }> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
  if (!apiKey) throw new Error('Missing VITE_GEMINI_API_KEY')

  const base64 = await blobToBase64(blob)
  const modelId = (import.meta.env.VITE_GEMINI_TRANSCRIBE_MODEL as string | undefined)?.trim() || 'gemini-2.5-pro'

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelId
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text:
                  'You are a transcription engine for study notes.\n' +
                  '1) Detect the spoken language automatically.\n' +
                  '2) Transcribe the audio and split it into segments with start and end timestamps in seconds.\n' +
                  '3) Use your own understanding to spell people names, place names, and historical terms as accurately as possible.\n' +
                  '4) Ensure each segment is at most about 30 seconds of speech.\n' +
                  '   Transcribe faithfully; do NOT hallucinate or repeat the same word or phrase more than twice in a row.\n' +
                  '5) Output format MUST be plain text, no markdown or JSON.\n' +
                  '6) First line: "language=<lang-code>" (for example: language=zh-TW).\n' +
                  '7) Then, one segment per line in the exact format: "<start_seconds>,<end_seconds>,<transcript text>".\n' +
                  '   Example line: 0.0,12.7,這是一句示範句子。\n' +
                  '8) Do not add any extra commentary before or after the lines.',
              },
              {
                inlineData: {
                  mimeType: blob.type || 'audio/webm',
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    }
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    try {
      const parsedErr = errText ? JSON.parse(errText) : null
      const message =
        parsedErr?.error?.message ||
        parsedErr?.error?.status ||
        `Gemini transcription failed: ${res.status}`
      throw new Error(message)
    } catch {
      throw new Error(errText || `Gemini transcription failed: ${res.status}`)
    }
  }

  const data = await res.json()
  const parts = data?.candidates?.[0]?.content?.parts
  let rawText: string | undefined
  if (Array.isArray(parts)) {
    const textPart = parts.find((p: any) => typeof p?.text === 'string')
    if (textPart) rawText = textPart.text as string
  }
  if (typeof rawText !== 'string') {
    console.error('Unexpected Gemini transcription response shape:', data)
    const snippet = JSON.stringify(data).slice(0, 400)
    throw new Error(`Unexpected transcription response shape. Raw snippet: ${snippet}`)
  }

  const lines = rawText.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
  if (lines.length === 0) {
    throw new Error('Empty transcription response')
  }

  // Parse language from first line: language=xx-YY
  let language = 'unknown'
  const langMatch = /^language\s*=\s*([A-Za-z0-9\-_]+)/.exec(lines[0])
  let segmentLines = lines
  if (langMatch) {
    language = langMatch[1]
    segmentLines = lines.slice(1)
  }

  const segments: TranscriptSegment[] = []
  for (const line of segmentLines) {
    // Expect: start,end,text  (text may contain commas)
    const m = /^([0-9]+(?:\.[0-9]+)?)[,\s]+([0-9]+(?:\.[0-9]+)?)[,\s]+(.+)$/.exec(line)
    if (!m) continue
    const start = Number(m[1])
    const end = Number(m[2])
    const text = m[3].trim()
    if (Number.isNaN(start) || Number.isNaN(end) || !text) continue
    segments.push({ startSeconds: start, endSeconds: end, text })
  }

  if (!segments.length) {
    const snippet = rawText.length > 400 ? `${rawText.slice(0, 400)}…` : rawText
    throw new Error(`Failed to parse transcription segments from response. Snippet: ${snippet}`)
  }

  return { language, segments }
}

