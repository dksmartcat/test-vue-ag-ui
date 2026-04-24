/**
 * Renders a scenario run as a standalone chat-style HTML report.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AiRunResult, RecordedStep, RunResult, StopReason } from './types'

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

function truncateForHtml(s: string, limit = 4000): string {
  return s.length > limit ? s.slice(0, limit) + '\n… [truncated]' : s
}

function stopReasonTone(reason: StopReason): 'ok' | 'warn' | 'error' {
  switch (reason) {
    case 'flow_ended':
    case 'stop_on_tool_call':
      return 'ok'
    case 'max_rounds':
    case 'max_text_messages':
      return 'warn'
    case 'missing_handler':
    case 'ai_user_stop':
    case 'run_error':
      return 'error'
  }
}

// ---------------------------------------------------------------------------
// Per-step renderer
// ---------------------------------------------------------------------------

function renderStepHtml(step: RecordedStep): string {
  switch (step.type) {
    case 'assistant_text':
      return `<div class="msg msg--assistant"><div class="bubble bubble--assistant">${escapeHtml(step.text)}</div></div>`

    case 'user_text':
      return `<div class="msg msg--user"><div class="bubble bubble--user">${escapeHtml(step.text)}</div></div>`

    case 'tool_call': {
      const badgeClass =
        step.source === 'backend' ? 'badge badge--backend' : 'badge badge--frontend'
      const argsFormatted = formatJson(step.args)
      const resultBlock = step.result
        ? `<details class="event__details"><summary>Result</summary><pre>${escapeHtml(
            truncateForHtml(step.result),
          )}</pre></details>`
        : ''
      return `<div class="event event--tool event--${step.source}">
        <div class="event__head">
          <span class="event__icon">🛠</span>
          <span class="event__title">${escapeHtml(step.tool)}</span>
          <span class="${badgeClass}">${step.source}</span>
        </div>
        <details class="event__details"><summary>Args</summary><pre>${escapeHtml(argsFormatted)}</pre></details>
        ${resultBlock}
      </div>`
    }

    case 'user_tool_response':
      return `<div class="event event--response">
        <div class="event__head">
          <span class="event__icon">↩︎</span>
          <span class="event__title">User → ${escapeHtml(step.tool)}</span>
        </div>
        <details class="event__details" open><summary>Payload</summary><pre>${escapeHtml(
          formatJson(step.response),
        )}</pre></details>
      </div>`

    case 'error':
      return `<div class="event event--error">
        <span class="event__icon">⚠︎</span>
        <span class="event__title">${escapeHtml(step.message)}</span>
      </div>`

    case 'ai_stop': {
      const cls = step.verdict === 'pass' ? 'event--pass' : 'event--fail'
      const icon = step.verdict === 'pass' ? '✓' : '✗'
      return `<div class="event ${cls}">
        <span class="event__icon">${icon}</span>
        <span class="event__title">AI verdict: ${step.verdict} — ${escapeHtml(step.reason)}</span>
      </div>`
    }
  }
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const HTML_STYLES = `
  :root {
    --bg: #f5f5f7;
    --card: #ffffff;
    --text: #1d1d1f;
    --muted: #6e6e73;
    --border: #e5e5ea;
    --user: #007aff;
    --assistant: #e9e9eb;
    --accent-warn: #ff9f0a;
    --accent-err: #ff3b30;
    --accent-ok: #30d158;
    --accent-backend: #af52de;
    --accent-frontend: #ff9500;
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: 24px;
    background: var(--bg);
    color: var(--text);
    font-size: 14px;
    line-height: 1.4;
  }
  .container { max-width: 920px; margin: 0 auto; }
  .header {
    background: var(--card);
    border-radius: 14px;
    padding: 20px 24px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
  }
  .header h1 { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
  .header .subtitle { color: var(--muted); font-size: 13px; margin-bottom: 14px; }
  .chip {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }
  .chip--ok { background: #e4f8eb; color: #1f7a3e; }
  .chip--warn { background: #fff4e0; color: #a36200; }
  .chip--error { background: #ffe4e1; color: #b0261e; }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-top: 14px;
  }
  .stat {
    text-align: center;
    padding: 10px;
    background: var(--bg);
    border-radius: 10px;
  }
  .stat__value { font-size: 18px; font-weight: 600; }
  .stat__label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .chat {
    background: var(--card);
    border-radius: 14px;
    padding: 18px 22px;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
  }
  .round-divider {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 18px 0 12px;
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .round-divider::before,
  .round-divider::after {
    content: "";
    flex: 1;
    border-top: 1px solid var(--border);
  }
  .msg { display: flex; margin: 6px 0; }
  .msg--user { justify-content: flex-end; }
  .msg--assistant { justify-content: flex-start; }
  .bubble {
    max-width: 75%;
    padding: 10px 14px;
    border-radius: 18px;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  .bubble--user {
    background: var(--user);
    color: white;
    border-bottom-right-radius: 6px;
  }
  .bubble--assistant {
    background: var(--assistant);
    color: var(--text);
    border-bottom-left-radius: 6px;
  }
  .event {
    margin: 8px 0;
    padding: 10px 14px;
    background: #fafafa;
    border-left: 3px solid var(--border);
    border-radius: 6px;
  }
  .event--frontend { border-left-color: var(--accent-frontend); background: #fff8ec; }
  .event--backend { border-left-color: var(--accent-backend); background: #f7eefc; }
  .event--response { border-left-color: var(--user); background: #e7f1ff; }
  .event--error { border-left-color: var(--accent-err); background: #ffe4e1; color: #b0261e; }
  .event--pass { border-left-color: var(--accent-ok); background: #e4f8eb; color: #1f7a3e; }
  .event--fail { border-left-color: var(--accent-err); background: #ffe4e1; color: #b0261e; }
  .event__head { display: flex; align-items: center; gap: 8px; }
  .event__icon { font-size: 14px; }
  .event__title { font-weight: 600; font-size: 13px; }
  .badge {
    font-size: 10px;
    font-weight: 500;
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
    letter-spacing: .5px;
  }
  .badge--frontend { background: var(--accent-frontend); color: white; }
  .badge--backend { background: var(--accent-backend); color: white; }
  .event__details {
    margin-top: 6px;
    font-size: 12px;
    color: var(--muted);
  }
  .event__details summary { cursor: pointer; user-select: none; }
  .event__details pre {
    margin: 6px 0 0;
    padding: 8px 10px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11.5px;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text);
  }
`

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function renderChatHtml(result: RunResult | AiRunResult): string {
  const { steps, rounds, stopReason, stopDetail, name } = result
  const verdict = (result as AiRunResult).verdict
  const verdictReason = (result as AiRunResult).verdictReason

  const toolCallCount = steps.filter((s) => s.type === 'tool_call').length
  const assistantCount = steps.filter((s) => s.type === 'assistant_text').length
  const userResponseCount = steps.filter(
    (s) => s.type === 'user_tool_response' || s.type === 'user_text',
  ).length
  const errorCount = steps.filter((s) => s.type === 'error').length

  let body = ''
  let currentRound = 0
  for (const step of steps) {
    if (step.round !== currentRound) {
      currentRound = step.round
      body += `<div class="round-divider"><span>Round ${currentRound}</span></div>`
    }
    body += renderStepHtml(step)
  }

  // Stop-chip tone: for AI runs, derive from verdict; otherwise from stopReason.
  const stopTone = verdict ? (verdict === 'pass' ? 'ok' : 'error') : stopReasonTone(stopReason)
  const verdictChip = verdict
    ? `<span class="chip chip--${verdict === 'pass' ? 'ok' : 'error'}" style="margin-left:6px;">Verdict: ${verdict}${
        verdictReason ? ' — ' + escapeHtml(verdictReason) : ''
      }</span>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(name)}</title>
<style>${HTML_STYLES}</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${escapeHtml(name)}</h1>
    <div class="subtitle">${rounds} round(s) · ${steps.length} recorded step(s)</div>
    <span class="chip chip--${stopTone}">Stop: ${escapeHtml(stopReason)}${
      stopDetail ? ' — ' + escapeHtml(stopDetail) : ''
    }</span>
    ${verdictChip}
    <div class="stats">
      <div class="stat"><div class="stat__value">${toolCallCount}</div><div class="stat__label">Tool calls</div></div>
      <div class="stat"><div class="stat__value">${assistantCount}</div><div class="stat__label">Assistant msgs</div></div>
      <div class="stat"><div class="stat__value">${userResponseCount}</div><div class="stat__label">User responses</div></div>
      <div class="stat"><div class="stat__value">${errorCount}</div><div class="stat__label">Errors</div></div>
    </div>
  </div>
  <div class="chat">
    ${body || '<div class="event">No steps recorded.</div>'}
  </div>
</div>
</body>
</html>`
}

/**
 * Save a pretty chat-style HTML transcript of a scenario run into a
 * `results/` directory next to the calling test file.
 */
export function saveChatHtml(
  result: RunResult | AiRunResult,
  testFileUrl: string,
  customName?: string,
): string {
  const testDir = path.dirname(fileURLToPath(testFileUrl))
  const resultsDir = path.join(testDir, 'results')
  fs.mkdirSync(resultsDir, { recursive: true })

  const baseName = (customName ?? result.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const filePath = path.join(resultsDir, `${baseName || 'scenario'}.html`)

  fs.writeFileSync(filePath, renderChatHtml(result), 'utf8')
  console.log(`  HTML report: ${filePath}`)
  return filePath
}
