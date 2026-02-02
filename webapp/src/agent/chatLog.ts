/**
 * Send chat interaction to the dev server so it can log to the terminal (realtime).
 * Only runs in DEV; no-op in production.
 */

export function chatLogToTerminal(
  type: 'user' | 'agent',
  payload: {
    text?: string
    logs?: string[]
    toolCalls?: Array<{ name: string; args?: Record<string, unknown>; result?: string; success?: boolean }>
    error?: string
  }
): void {
  if (import.meta.env.DEV && typeof fetch !== 'undefined') {
    fetch('/__chat-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...payload }),
    }).catch(() => {})
  }
}
