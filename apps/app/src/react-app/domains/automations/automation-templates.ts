import type { AutomationSchedule, CreateAutomation } from "@openwork/types/automations"

export type AutomationTemplate = {
  id: string
  name: string
  description: string
  category: string
  icon: string
  instructions: string
  schedule: Extract<AutomationSchedule, { kind: "daily" | "weekly" }>
  model?: CreateAutomation["model"]
}

export const AUTOMATION_TEMPLATES: readonly AutomationTemplate[] = [
  {
    id: "daily-news-digest",
    name: "Daily news digest",
    description: "Push a concise summary of the most important tech news every morning.",
    category: "Information",
    icon: "Newspaper",
    instructions:
      "Search for the most important tech news today and compile a concise summary with headlines, key takeaways, and source links.",
    schedule: { kind: "daily", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", hour: 9, minute: 0 },
  },
  {
    id: "weekly-report",
    name: "Weekly report",
    description: "Generate a structured summary of the week's work every Friday.",
    category: "Productivity",
    icon: "FileText",
    instructions:
      "Review this week's work conversations and completed tasks. Generate a structured weekly report covering: completed items, in-progress items, and next week's plan.",
    schedule: { kind: "weekly", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", hour: 17, minute: 0, daysOfWeek: [5] },
  },
  {
    id: "code-review",
    name: "Code review reminder",
    description: "Periodically remind yourself to review open pull requests.",
    category: "Developer tools",
    icon: "GitPullRequest",
    instructions:
      "Check GitHub for all open pull requests awaiting review. Compile them into a list and remind the reviewer to take action.",
    schedule: { kind: "daily", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", hour: 10, minute: 0 },
  },
  {
    id: "health-reminder",
    name: "Health reminder",
    description: "Timely reminders to rest, hydrate, and stretch throughout the day.",
    category: "Personal",
    icon: "Heart",
    instructions:
      "Remind the user to stand up, drink water, and rest their eyes. Include one simple stretching exercise suggestion each time.",
    schedule: { kind: "daily", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", hour: 10, minute: 0 },
  },
  {
    id: "learning-plan",
    name: "Learning plan",
    description: "Daily bite-sized tech learning material and a practice exercise.",
    category: "Growth",
    icon: "GraduationCap",
    instructions:
      "Pick a tech topic, produce a short learning resource with key concepts and a practice exercise to help the user learn continuously.",
    schedule: { kind: "daily", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", hour: 14, minute: 0 },
  },
  {
    id: "data-backup",
    name: "Data backup check",
    description: "Periodically verify the backup status of important directories.",
    category: "Operations",
    icon: "Database",
    instructions:
      "Check file changes in the specified directories and generate a backup status report.",
    schedule: { kind: "weekly", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", hour: 18, minute: 0, daysOfWeek: [1] },
  },
] as const

export function templatesByCategory(): Map<string, readonly AutomationTemplate[]> {
  const grouped = new Map<string, AutomationTemplate[]>()
  for (const template of AUTOMATION_TEMPLATES) {
    const list = grouped.get(template.category) ?? []
    list.push(template)
    grouped.set(template.category, list)
  }
  return grouped
}
