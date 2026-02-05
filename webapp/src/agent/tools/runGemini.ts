/** Call Gemini with a single prompt (no tools). Used inside tool implementations. Optional images are passed as data URLs. */
export type CallGeminiFn = (prompt: string, systemHint?: string, images?: string[]) => Promise<string>

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(',')
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

export function createCallGemini(apiKey: string, modelApiId: string): CallGeminiFn {
  return async (prompt: string, systemHint?: string, images?: string[]) => {
    const system = systemHint ?? 'You are a helpful assistant for Learning IDE. Reply in Cantonese when appropriate. Output only what is asked, no extra commentary unless needed.'
    const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [{ text: prompt }]
    if (images && images.length) {
      for (const img of images) {
        if (!img) continue
        parts.push({
          inline_data: { mime_type: 'image/png', data: dataUrlToBase64(img) },
        })
      }
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelApiId}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          systemInstruction: { parts: [{ text: system }] },
          generationConfig: { temperature: 0.5, maxOutputTokens: 65536 },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || `API error ${res.status}`)
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    return text?.trim() ?? ''
  }
}
