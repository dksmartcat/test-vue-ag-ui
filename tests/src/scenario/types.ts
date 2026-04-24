/**
 * Shared types for the scenario runners, verifier, and report renderer.
 *
 * Two separate runner modes — classic (static handlers) and AI (LLM-driven
 * user) — each with its own config shape. They never overlap: pick one.
 */
import type { FileInput } from '../drive'
import type { ToolHandler } from '../tools'

// ---------------------------------------------------------------------------
// Classic scenario config — deterministic handlers + fixed text reply.
// ---------------------------------------------------------------------------

export interface ClassicUserConfig {
  name: string
  message: string
  files: FileInput[]
  /** Handlers for frontend tools. Key = tool name, value = handler function. */
  handlers: Record<string, ToolHandler>
  /** Default text reply when agent asks a question (default: "ok"). */
  textReply?: string
  /** Maximum rounds to run (default: 20). */
  maxRounds?: number
  /** Maximum text messages from user — safety limit (default: 5). */
  maxTextMessages?: number
  /**
   * Stop the scenario as soon as a tool call matches this predicate.
   * Runs BEFORE the handler is invoked — the matched tool call is the last
   * recorded step, without a user response.
   */
  stopOnToolCall?: (toolName: string, args: Record<string, unknown>) => boolean
}

// ---------------------------------------------------------------------------
// AI scenario config — self-contained LLM-driven user.
//
// No `handlers`, no `textReply`, no `stopOnToolCall`. The AI itself decides
// when the scenario is done (success or failure) based on the scenario text.
// ---------------------------------------------------------------------------

export interface AiUserConfig {
  name: string
  message: string
  files: FileInput[]
  /**
   * Plain-language description of the user's goal AND the exit conditions
   * for this test. Must describe:
   *   1. How the user should behave (what to pick, what to type).
   *   2. When the test should be considered PASSED — the agent reached the
   *      expected milestone (e.g. "confirm_action was shown with Russian").
   *   3. When the test should be considered FAILED — the agent diverged
   *      (e.g. "the picker appeared again after the language was named").
   * The AI emits a verdict together with its stop decision.
   */
  scenario: string
  /** Optional extra guidance prepended to the system prompt. */
  instructions?: string
  /** Model temperature (default: 0.2). */
  temperature?: number
  /** Maximum rounds to run (default: 20). */
  maxRounds?: number
  /** Maximum text messages from user — safety limit (default: 5). */
  maxTextMessages?: number
}

// ---------------------------------------------------------------------------
// Recorded steps
// ---------------------------------------------------------------------------

export type RecordedStep =
  | { type: 'assistant_text'; round: number; text: string }
  | {
      type: 'tool_call'
      round: number
      tool: string
      toolCallId: string
      source: 'frontend' | 'backend'
      args: string
      result?: string
    }
  | { type: 'user_tool_response'; round: number; tool: string; toolCallId: string; response: string }
  | { type: 'user_text'; round: number; text: string }
  | { type: 'error'; round: number; message: string }
  /** Emitted by the AI runner when the AI user decided to stop. Not an error. */
  | { type: 'ai_stop'; round: number; verdict: AiVerdict; reason: string }

export type StopReason =
  | 'flow_ended' // Agent produced neither tool calls nor text — natural end
  | 'max_rounds' // Round limit reached
  | 'max_text_messages' // Text reply safety limit reached
  | 'stop_on_tool_call' // (classic) stopOnToolCall predicate matched
  | 'missing_handler' // (classic) No handler registered for a frontend tool
  | 'ai_user_stop' // (ai) AI user decided to stop the scenario
  | 'run_error' // Run error or exception from the agent stream

export type AiVerdict = 'pass' | 'fail'

export interface RunResult {
  steps: RecordedStep[]
  rounds: number
  /** Why the run ended. */
  stopReason: StopReason
  /** Human-readable detail attached to the stop (tool name, message, etc.). */
  stopDetail?: string
  /** Name of the scenario that produced this result. */
  name: string
}

export interface AiRunResult extends RunResult {
  /** Final verdict from the AI user. Populated whenever AI decided to stop. */
  verdict?: AiVerdict
  /** Short reason returned by AI alongside the verdict. */
  verdictReason?: string
}

// ---------------------------------------------------------------------------
// Expected scenario (for classic verifier)
// ---------------------------------------------------------------------------

export interface FlowToolStep {
  tool: string
  resultContains?: string
  count?: number
  optional?: boolean
  /** Called during verification when the step matches. Throw to fail. */
  check?: (args: Record<string, unknown>, result: string | undefined) => void
}

export interface FlowTextStep {
  text: true
  /** If set, the text message must contain this substring */
  contains?: string
  count?: number
  optional?: boolean
}

export type FlowStep = FlowToolStep | FlowTextStep

/** A repeating group of steps. The entire block repeats `count` times. */
export interface FlowBlock {
  block: FlowStep[]
  count: number
}

export type FlowEntry = FlowStep | FlowBlock

export interface ExpectedScenario {
  steps: FlowEntry[]
  /** Tool name patterns that are always allowed anywhere in the flow (prefix or regex) */
  optionalTools?: Array<string | RegExp>
}

export interface VerifyResult {
  success: boolean
  error: string | null
  matchedSteps: Array<{ step: string; round: number }>
}

// ---------------------------------------------------------------------------
// Type-guards shared by verifier + AI user
// ---------------------------------------------------------------------------

export function isBlock(entry: FlowEntry): entry is FlowBlock {
  return 'block' in entry
}

export function isTextStep(step: FlowStep): step is FlowTextStep {
  return 'text' in step
}

export function isToolStep(step: FlowStep): step is FlowToolStep {
  return 'tool' in step
}
