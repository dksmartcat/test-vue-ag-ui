import type { AiUserConfig } from '../../../scenario'
import { loadScenarioFiles } from '../../loadFiles'

/**
 * AI-driven multi-turn scenario:
 *   1. User uploads a .txt document and goes through the full translation
 *      flow. Phase 1 is NOT considered complete until the backend workflow
 *      execution actually starts — at minimum the `await_auto_translation`
 *      tool must have fired (confirming the translation run, not just plan
 *      preparation). `display_project` is an even stronger success signal
 *      if it appears.
 *   2. User asks a short HelpCenter question ("что такое smartwords?"). The
 *      agent must route to the help-center specialist and the knowledge base
 *      search must actually run — `Create_SearchHelpCenter_0` must appear in
 *      the transcript. A text answer must follow.
 *   3. User asks to re-translate the SAME file, this time into Spanish
 *      (typed naturally: "переведи опять мой последний файл только теперь на
 *      испанский"). The agent must reuse the file already in history and
 *      switch target language to Spanish. PASS is emitted when a second
 *      `confirm_action` fires with a Spanish target (`es` or `es-*`).
 */
export const aiRetranslateAfterHelpCenterUser: AiUserConfig = {
  name: 'AI user — translate, ask help center, retranslate last file to Spanish',
  message: 'translate',
  files: loadScenarioFiles(import.meta.url),
  scenario: [
    'You are a user who uploaded a single .txt document. The conversation has',
    'three distinct phases. Follow them in order and never skip phases.',
    '',
    '## Phase 1 — translate the uploaded document to Russian',
    '- Source language: English.',
    '- Target language: Russian.',
    '- Workflow stages: accept the default stage set.',
    '- For any other picker (template, etc.), accept the default by replying',
    '  with `{"userMessage": "accept defaults"}` so the agent applies its own',
    '  defaults and moves on.',
    '- When the agent shows a plan via `confirm_action`, confirm it with',
    '  `{"confirmed": true}`. (This matches the real frontend contract —',
    "  anything else, e.g. `{\"action\":\"confirm\"}`, is ignored by the backend",
    '  and the translation workflow will never start.)',
    '- If `display_project` fires, acknowledge it with',
    "  `{\"status\": \"displayed\"}` (a non-empty object — never `{}`).",
    '- Phase 1 is complete ONLY AFTER the backend workflow execution actually',
    '  starts. The concrete signal is the `await_auto_translation` tool call',
    '  appearing in the transcript (a stronger signal is `display_project`).',
    '  Do NOT move on to Phase 2 until you see `await_auto_translation` or',
    '  `display_project` in the recorded tool calls.',
    '- If the agent goes idle AFTER `confirm_action` was confirmed but BEFORE',
    '  `await_auto_translation` / `display_project` has fired, emit',
    '  verdict="fail" with a reason that the translation run never started.',
    '',
    '## Phase 2 — ask a short HelpCenter question',
    '- Once Phase 1 is complete, the agent usually goes idle. When the runner',
    '  asks what to do next, send EXACTLY this short text message (do not',
    '  paraphrase, do not expand — keep it short and user-like):',
    '    "что такое smartwords?"',
    '- The agent must route this through its help-center specialist and the',
    '  knowledge base search tool must run. The concrete signal is a',
    '  `Create_SearchHelpCenter_0` tool call appearing in the transcript.',
    '- A plain-text answer must follow. If no text answer arrives, or if',
    '  `Create_SearchHelpCenter_0` never fires, emit verdict="fail".',
    '- After the help-center answer, briefly acknowledge it with EXACTLY one',
    '  word: "Thanks". This acknowledgement MUST be a separate turn from the',
    '  re-translate request in Phase 3 — never combine them.',
    '',
    '## Phase 3 — re-translate the SAME file to SPANISH',
    '- Send EXACTLY this short text (do not paraphrase):',
    '    "переведи опять мой последний файл только теперь на испанский"',
    '- The agent must reuse the file already in history — NEVER ask for a',
    '  fresh upload. If it does ask for a re-upload, emit verdict="fail".',
    '- If the agent re-opens the `choose_target_language` picker, respond',
    '  with `{"targetLanguageTags":["es"]}`.',
    '- For `choose_workflow_stages`, reply `{"userMessage":"accept defaults"}`.',
    '- For any other picker, reply `{"userMessage":"accept defaults"}`.',
    '- When `confirm_action` fires for the SECOND time in the whole',
    '  conversation, inspect its args:',
    '    - If the target language is Spanish (tag starts with "es", e.g. "es"',
    '      or "es-ES" or "es-MX"), respond with `{"confirmed": true}` and',
    '      then emit verdict="pass" on the next decision. This is the exit.',
    '    - If the target is anything OTHER than Spanish (e.g. still Russian),',
    '      emit verdict="fail" with a reason that the target language did not',
    '      switch to Spanish.',
    '',
    '## Exit conditions (summary)',
    '- PASS: all three phases completed — Phase 1 reached',
    '  `await_auto_translation` (or `display_project`); Phase 2 produced a',
    '  `Create_SearchHelpCenter_0` call and a text answer; Phase 3 reached a',
    '  second `confirm_action` with a Spanish target, which was confirmed.',
    '- FAIL:',
    '  - Phase 1 never reaches `await_auto_translation` / `display_project`',
    '    (translation run never actually started).',
    '  - Phase 2 never reaches `Create_SearchHelpCenter_0`, or no text answer.',
    '  - Phase 3: agent asks for re-upload, or the second `confirm_action`',
    '    fires with a non-Spanish target, or it never fires within the budget.',
    '  - Same frontend tool fires 3 rounds in a row WITHIN a single phase',
    '    (cross-phase repeats like `confirm_action` are expected, not a loop).',
  ].join('\n'),
  maxRounds: 40,
  maxTextMessages: 6,
}
