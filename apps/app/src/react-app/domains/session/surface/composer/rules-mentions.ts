import type { MentionOption } from "./mention-types";

/**
 * "@Rules" mentions reference a coding-standard rule the agent should follow.
 * Rules live in .openwork/rules/<name>.md (or similar) on the workspace.
 */

export type RuleType = "always" | "requested" | "manual";

export interface RuleDefinition {
  name: string;
  description: string;
  ruleType: RuleType;
}

/** Label suffix for the rule-type badge shown in descriptions. */
export function ruleTypeLabel(ruleType: RuleType): string {
  if (ruleType === "always") return "Always";
  if (ruleType === "requested") return "On request";
  return "Manual";
}

/** List available rules as mention options. */
export function listRulesMentions(rules: RuleDefinition[]): MentionOption[] {
  return rules.map((rule) => ({
    id: `rules:${rule.name}`,
    kind: "rules",
    value: rule.name,
    label: rule.name,
    description: `${ruleTypeLabel(rule.ruleType)} · ${rule.description}`.slice(0, 100),
    icon: "ShieldCheck",
  }));
}

/** Resolve a rules mention value to its definition. */
export function resolveRulesMention(value: string, rules: RuleDefinition[]): RuleDefinition | undefined {
  return rules.find((rule) => rule.name === value);
}
