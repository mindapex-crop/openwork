import type { AutomationSchedule } from "@openwork/types/automations"

export function previewNextRuns(schedule: AutomationSchedule, count = 3, from = Date.now()): number[] {
  const results: number[] = []
  let cursor = from

  while (results.length < count) {
    const next = nextOccurrence(schedule, cursor)
    if (next === null) break
    results.push(next)
    cursor = next + 1000
  }
  return results
}

function nextOccurrence(schedule: AutomationSchedule, from: number): number | null {
  if (schedule.kind === "once") return schedule.at > from ? schedule.at : null

  if (schedule.kind === "daily") {
    const base = new Date(from)
    base.setHours(schedule.hour, schedule.minute, 0, 0)
    if (base.getTime() <= from) base.setDate(base.getDate() + 1)
    return base.getTime()
  }

  // weekly
  const sorted = [...schedule.daysOfWeek].sort((left, right) => left - right)
  const base = new Date(from)
  const fromDay = base.getDay()
  const currentMinute = base.getHours() * 60 + base.getMinutes()
  const targetMinute = schedule.hour * 60 + schedule.minute

  for (let offset = 0; offset < 7; offset++) {
    const candidateDay = (fromDay + offset) % 7
    if (!sorted.includes(candidateDay)) continue
    if (offset === 0 && targetMinute <= currentMinute) continue
    const day = new Date(base)
    day.setDate(base.getDate() + offset)
    day.setHours(schedule.hour, schedule.minute, 0, 0)
    return day.getTime()
  }

  // All matching days already passed this week; jump to the first one next week.
  const first = new Date(base)
  const firstDay = sorted[0]
  const offset = ((firstDay - fromDay + 7) % 7) + 7
  first.setDate(base.getDate() + offset)
  first.setHours(schedule.hour, schedule.minute, 0, 0)
  return first.getTime()
}

export function formatNextRuns(schedule: AutomationSchedule, count = 3): string[] {
  return previewNextRuns(schedule, count).map((value) =>
    new Date(value).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  )
}
