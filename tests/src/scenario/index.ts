/**
 * Public surface of the scenario framework.
 *
 * Two independent run modes:
 *   - Classic — deterministic handlers + fixed text reply.
 *       Config: `ClassicUserConfig`.
 *       Runner: `runScenario` → `RunResult`.
 *       Verification: pair with `ExpectedScenario` + `verifySteps`.
 *
 *   - AI — self-contained LLM-driven user with its own exit conditions.
 *       Config: `AiUserConfig` (scenario text includes pass/fail rules).
 *       Runner: `runAiScenario` → `AiRunResult` (adds `verdict` + `verdictReason`).
 *       Verification: check `result.verdict === 'pass'`.
 *
 * Reporting utilities (`printSteps`, `renderChatHtml`, `saveChatHtml`) work
 * with both modes.
 */
export type {
  ClassicUserConfig,
  AiUserConfig,
  AiVerdict,
  RecordedStep,
  StopReason,
  RunResult,
  AiRunResult,
  FlowToolStep,
  FlowTextStep,
  FlowStep,
  FlowBlock,
  FlowEntry,
  ExpectedScenario,
  VerifyResult,
} from './types'

export { runScenario } from './runner'
export { runAiScenario, expectAiPass } from './ai-runner'
export { verifySteps } from './verifier'
export { printSteps } from './printer'
export { renderChatHtml, saveChatHtml } from './html-report'
