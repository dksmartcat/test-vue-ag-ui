/**
 * Match a recorded run against an expected scenario of tool calls and text
 * rounds. Advances a cursor through `expected.steps`, skipping optional
 * steps, and fails on the first out-of-order required step.
 */
import type {
  ExpectedScenario,
  FlowEntry,
  FlowStep,
  RecordedStep,
  RunResult,
  VerifyResult,
} from './types'
import { isBlock, isTextStep, isToolStep } from './types'

// ---------------------------------------------------------------------------
// Labels / flattening
// ---------------------------------------------------------------------------

export function stepLabel(step: FlowStep): string {
  if (isTextStep(step)) {
    let label = '[text]'
    if (step.contains) label += ` (contains "${step.contains}")`
    if (step.count && step.count > 1) label += ` x${step.count}`
    if (step.optional) label += ' [optional]'
    return label
  }
  let label = step.tool
  if (step.resultContains) label += ` (contains "${step.resultContains}")`
  if (step.count && step.count > 1) label += ` x${step.count}`
  if (step.optional) label += ' [optional]'
  return label
}

export function entryLabel(entry: FlowEntry): string {
  if (isBlock(entry)) {
    const inner = entry.block.map(stepLabel).join(', ')
    return `[${inner}] x${entry.count}`
  }
  return stepLabel(entry)
}

/** Expand FlowEntry[] into a flat FlowStep[] list. */
export function expandEntries(entries: FlowEntry[]): FlowStep[] {
  const result: FlowStep[] = []
  for (const entry of entries) {
    if (isBlock(entry)) {
      for (let i = 0; i < entry.count; i++) {
        for (const s of entry.block) {
          result.push({ ...s, count: undefined })
        }
      }
    } else {
      const n = entry.count ?? 1
      for (let i = 0; i < n; i++) {
        result.push({ ...entry, count: undefined })
      }
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Match helpers
// ---------------------------------------------------------------------------

function isOptionalTool(toolName: string, patterns: Array<string | RegExp>): boolean {
  return patterns.some((p) =>
    typeof p === 'string' ? toolName.startsWith(p) : p.test(toolName),
  )
}

function matchesToolStep(
  step: FlowStep,
  toolName: string,
  resultContent: string | undefined,
): boolean {
  if (!isToolStep(step)) return false
  if (toolName !== step.tool) return false
  if (step.resultContains && (!resultContent || !resultContent.includes(step.resultContains))) {
    return false
  }
  return true
}

function matchesTextStep(step: FlowStep, textContent: string): boolean {
  if (!isTextStep(step)) return false
  if (step.contains && !textContent.includes(step.contains)) return false
  return true
}

interface MatchResult {
  matched: boolean
  newCursor: number
}

function tryMatchCursor(
  expanded: FlowStep[],
  cursor: number,
  matchFn: (step: FlowStep) => boolean,
): MatchResult {
  let searchIdx = cursor

  while (searchIdx < expanded.length) {
    const candidate = expanded[searchIdx]!
    if (matchFn(candidate)) {
      for (let si = cursor; si < searchIdx; si++) {
        if (!expanded[si]!.optional) {
          return { matched: false, newCursor: cursor }
        }
      }
      return { matched: true, newCursor: searchIdx + 1 }
    }

    if (expanded[searchIdx]!.optional) {
      searchIdx++
      continue
    }

    break
  }

  return { matched: false, newCursor: cursor }
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export function verifySteps(result: RunResult, expected: ExpectedScenario): VerifyResult {
  const expanded = expandEntries(expected.steps)
  const optPatterns = expected.optionalTools ?? []
  const matchedSteps: VerifyResult['matchedSteps'] = []
  let cursor = 0
  let error: string | null = null

  console.log(`\n=== Verifying against ${expanded.length} expected steps ===`)
  console.log(`  Expected: ${expected.steps.map(entryLabel).join(', ')}`)

  const roundMap = new Map<number, RecordedStep[]>()
  for (const step of result.steps) {
    if (!roundMap.has(step.round)) roundMap.set(step.round, [])
    roundMap.get(step.round)!.push(step)
  }

  const roundNumbers = [...roundMap.keys()].sort((a, b) => a - b)

  for (const roundNum of roundNumbers) {
    if (error) break

    const roundSteps = roundMap.get(roundNum)!
    const toolCalls = roundSteps.filter(
      (s): s is Extract<RecordedStep, { type: 'tool_call' }> => s.type === 'tool_call',
    )
    const assistantTexts = roundSteps.filter(
      (s): s is Extract<RecordedStep, { type: 'assistant_text' }> => s.type === 'assistant_text',
    )

    // ===== Tool calls =====
    for (const tc of toolCalls) {
      if (error) break

      if (cursor >= expanded.length) {
        if (isOptionalTool(tc.tool, optPatterns)) {
          console.log(`  R${roundNum}: ~ ${tc.tool} (optional, after all steps)`)
          continue
        }
        error = `Unexpected tool call "${tc.tool}" after all expected steps completed`
        console.log(`  R${roundNum}: x ${error}`)
        break
      }

      const match = tryMatchCursor(expanded, cursor, (step) =>
        matchesToolStep(step, tc.tool, tc.result),
      )

      if (match.matched) {
        for (let si = cursor; si < match.newCursor - 1; si++) {
          console.log(`  R${roundNum}: ~ ${stepLabel(expanded[si]!)} (skipped)`)
        }

        const matchedStep = expanded[match.newCursor - 1]!
        console.log(`  R${roundNum}: + ${stepLabel(matchedStep)}`)

        if (isToolStep(matchedStep) && matchedStep.check) {
          try {
            const args = JSON.parse(tc.args) as Record<string, unknown>
            matchedStep.check(args, tc.result)
            console.log(`  R${roundNum}: + check passed`)
          } catch (err) {
            error = `Check failed for "${tc.tool}": ${err instanceof Error ? err.message : String(err)}`
            console.log(`  R${roundNum}: x ${error}`)
            break
          }
        }

        matchedSteps.push({ step: stepLabel(matchedStep), round: roundNum })
        cursor = match.newCursor
        continue
      }

      if (isOptionalTool(tc.tool, optPatterns)) {
        console.log(`  R${roundNum}: ~ ${tc.tool} (scenario optional)`)
        continue
      }

      const isKnownOptional = expanded.some(
        (s) => s.optional && matchesToolStep(s, tc.tool, tc.result),
      )
      if (isKnownOptional) {
        console.log(`  R${roundNum}: ~ ${tc.tool} (optional, out of order)`)
        continue
      }

      const expectedLabel = expanded[cursor] ? stepLabel(expanded[cursor]!) : '(end)'
      error = `Unexpected tool call "${tc.tool}" at step ${cursor + 1}/${expanded.length} (expected: ${expectedLabel})`
      console.log(`  R${roundNum}: x ${error}`)
      break
    }

    if (error) break

    // ===== Text =====
    if (assistantTexts.length > 0) {
      const textContent = assistantTexts.map((t) => t.text).join('\n')
      const match = tryMatchCursor(expanded, cursor, (step) => matchesTextStep(step, textContent))

      if (match.matched) {
        for (let si = cursor; si < match.newCursor - 1; si++) {
          console.log(`  R${roundNum}: ~ ${stepLabel(expanded[si]!)} (skipped)`)
        }
        const matchedStep = expanded[match.newCursor - 1]!
        console.log(`  R${roundNum}: + ${stepLabel(matchedStep)}`)
        matchedSteps.push({ step: stepLabel(matchedStep), round: roundNum })
        cursor = match.newCursor
      } else {
        const isKnownOptional = expanded.some(
          (s) => s.optional && matchesTextStep(s, textContent),
        )
        if (isKnownOptional) {
          console.log(`  R${roundNum}: ~ text (optional, out of order)`)
        } else {
          const nextStep = cursor < expanded.length ? expanded[cursor] : undefined
          if (nextStep && isToolStep(nextStep)) {
            console.log(
              `  R${roundNum}: ~ text (informational, next expected: "${nextStep.tool}")`,
            )
          } else if (cursor < expanded.length) {
            const expectedLabel = stepLabel(expanded[cursor]!)
            error = `Unexpected text at step ${cursor + 1}/${expanded.length} (expected: ${expectedLabel}). Text: "${textContent.slice(0, 100)}"`
            console.log(`  R${roundNum}: x ${error}`)
            break
          } else {
            console.log(`  R${roundNum}: ~ text (after all steps)`)
          }
        }
      }
    }

    if (cursor >= expanded.length) {
      console.log(`\n=== All steps matched after round ${roundNum}! ===`)
      return { success: true, error: null, matchedSteps }
    }
  }

  if (!error) {
    const remaining = expanded.slice(cursor).filter((s) => !s.optional)
    if (remaining.length > 0) {
      error = `Flow ended with ${remaining.length} required step(s) remaining: ${remaining.map(stepLabel).join(', ')}`
    }
  }

  const success = error === null
  console.log(`\n=== Verification: ${success ? 'PASS' : 'FAIL'} ===`)
  console.log(`  Matched: ${matchedSteps.map((s) => `R${s.round}:${s.step}`).join(', ')}`)
  if (error) console.log(`  Error: ${error}`)

  return { success, error, matchedSteps }
}
