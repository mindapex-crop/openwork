import { useCallback, useMemo, useState } from "react"
import type { AutomationSchedule, CreateAutomation } from "@openwork/types/automations"
import { AUTOMATION_TEMPLATES, type AutomationTemplate } from "./automation-templates"

export function useAutomationTemplates() {
  return useMemo(() => AUTOMATION_TEMPLATES, [])
}

function localTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

const NL_DAILY_PATTERNS = [
  /每天|每日|天天/,
  /每天早上|每天早上|每天上午/,
  /每天晚上|每晚|每天下午/,
]

const NL_WEEKLY_PATTERNS = [
  /每周/,
  /星期[一二三四五六日]/,
  /周[一二三四五六日]/,
]

const NL_HOUR_MAP: Array<{ pattern: RegExp; hour: number }> = [
  { pattern: /凌晨\s*1\s*点/, hour: 1 },
  { pattern: /凌晨\s*2\s*点/, hour: 2 },
  { pattern: /凌晨\s*3\s*点/, hour: 3 },
  { pattern: /凌晨\s*4\s*点/, hour: 4 },
  { pattern: /凌晨\s*5\s*点/, hour: 5 },
  { pattern: /早上\s*6\s*点/, hour: 6 },
  { pattern: /早上\s*7\s*点/, hour: 7 },
  { pattern: /早上\s*8\s*点/, hour: 8 },
  { pattern: /早上\s*9\s*点|早晨\s*9\s*点/, hour: 9 },
  { pattern: /上午\s*10\s*点/, hour: 10 },
  { pattern: /上午\s*11\s*点/, hour: 11 },
  { pattern: /中午\s*12\s*点/, hour: 12 },
  { pattern: /下午\s*1\s*点/, hour: 13 },
  { pattern: /下午\s*2\s*点/, hour: 14 },
  { pattern: /下午\s*3\s*点/, hour: 15 },
  { pattern: /下午\s*4\s*点/, hour: 16 },
  { pattern: /下午\s*5\s*点/, hour: 17 },
  { pattern: /下午\s*6\s*点/, hour: 18 },
  { pattern: /晚上\s*7\s*点/, hour: 19 },
  { pattern: /晚上\s*8\s*点/, hour: 20 },
  { pattern: /晚上\s*9\s*点/, hour: 21 },
  { pattern: /晚上\s*10\s*点/, hour: 22 },
  { pattern: /晚上\s*11\s*点/, hour: 23 },
  { pattern: /凌晨\s*0\s*点|半夜\s*12\s*点/, hour: 0 },
]

const WEEKDAY_MAP: Array<{ pattern: RegExp; day: number }> = [
  { pattern: /周天|星期天|周日|礼拜天|礼拜日/, day: 0 },
  { pattern: /周一|星期一|礼拜一/, day: 1 },
  { pattern: /周二|星期二|礼拜二/, day: 2 },
  { pattern: /周三|星期三|礼拜三/, day: 3 },
  { pattern: /周四|星期四|礼拜四/, day: 4 },
  { pattern: /周五|星期五|礼拜五/, day: 5 },
  { pattern: /周六|星期六|礼拜六/, day: 6 },
]

function detectSchedule(input: string): AutomationSchedule {
  const text = input

  for (const { pattern, day } of WEEKDAY_MAP) {
    if (pattern.test(text)) {
      const hour = detectHour(text)
      return {
        kind: "weekly",
        timezone: localTimezone(),
        daysOfWeek: [day],
        hour,
        minute: 0,
      }
    }
  }

  if (NL_WEEKLY_PATTERNS.some((entry) => entry.test(text))) {
    const hour = detectHour(text)
    return {
      kind: "weekly",
      timezone: localTimezone(),
      daysOfWeek: [1, 2, 3, 4, 5],
      hour,
      minute: 0,
    }
  }

  if (NL_DAILY_PATTERNS.some((entry) => entry.test(text)) || /点/.test(text)) {
    const hour = detectHour(text)
    return { kind: "daily", timezone: localTimezone(), hour, minute: 0 }
  }

  return { kind: "daily", timezone: localTimezone(), hour: 9, minute: 0 }
}

function detectHour(text: string): number {
  for (const { pattern, hour } of NL_HOUR_MAP) {
    if (pattern.test(text)) return hour
  }
  const matchText = text.match(/(\d{1,2})\s*点/)
  if (matchText) {
    const hour = Number.parseInt(matchText[1], 10)
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23) return hour
  }
  return 9
}

function deriveName(input: string): string {
  const cleaned = input
    .replace(/每天|每日|每周|天天|早上|上午|下午|晚上|凌晨|中午|早晨|点/g, " ")
    .replace(/[，。、；！？,.;!?\s]+/g, " ")
    .trim()
  return cleaned.slice(0, 120) || "New automation"
}

export function parseNaturalLanguage(input: string): Partial<CreateAutomation> {
  const text = input.trim()
  if (!text) return {}

  const schedule = detectSchedule(text)
  const name = deriveName(text)
  const instructions = `Complete the following task: ${text}`

  return { name, instructions, schedule }
}

export type TestRunState = {
  running: boolean
  runId: string | null
  error: string | null
}

export function useTestRun() {
  const [state, setState] = useState<TestRunState>({
    running: false,
    runId: null,
    error: null,
  })

  const reset = useCallback(() => {
    setState({ running: false, runId: null, error: null })
  }, [])

  return { state, setState, reset }
}

export function templateToCreate(template: AutomationTemplate, model: CreateAutomation["model"]): CreateAutomation {
  return {
    name: template.name,
    instructions: template.instructions,
    schedule: template.schedule,
    model: template.model ?? model,
  }
}
