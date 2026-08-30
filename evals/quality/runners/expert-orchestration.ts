/**
 * Expert orchestration domain runner (L2).
 *
 * Exercises the real product orchestration primitives with a golden expert
 * configuration: `selectMember` resolves a dispatch policy against a member
 * list, `filterMembersByCapabilities` computes the eligible set, and
 * `STRATEGY_META` describes team strategies. The case input is a plain JSON
 * expert configuration; the actual output is the deterministic orchestration
 * result, which the deterministic judge then compares to the case's expected
 * shape/values.
 *
 * The product modules are loaded with a runtime-only dynamic import: the path
 * is a string variable, so the TypeScript compiler never descends into
 * apps/server (whose sources are compiled under different options), while Node
 * 24 resolves the explicit `.ts` extension natively. Local structural types
 * keep the runner type-safe without pulling the server's type graph in.
 */
import type { GoldenCase } from "../judge.ts";

/** Structural mirrors of the product types we consume (no type-graph import). */
interface MemberLike {
  agentId: string;
  role?: string;
  capabilities?: Record<string, unknown>;
  handle?: unknown;
}

interface DispatchPolicyLike {
  kind: string;
  required?: Record<string, unknown>;
  primary?: string;
  fallbacks?: string[];
  role?: string;
}

interface ProductDispatchModule {
  selectMember(policy: DispatchPolicyLike, members: MemberLike[], teamId: string): MemberLike | null;
  filterMembersByCapabilities(members: MemberLike[], required: Record<string, unknown>): MemberLike[];
}

interface ProductStrategiesModule {
  STRATEGY_META: Record<string, { id: string; complexity: string; costLevel: string; qualityLevel: string }>;
}

export interface ExpertOrchestrationActual {
  policyKind: string;
  selectedAgentId: string | null;
  eligibleAgents: string[];
  strategyMeta?: {
    id: string;
    complexity: string;
    costLevel: string;
    qualityLevel: string;
  };
}

// String-variable specifiers: never statically resolved by tsc, resolved by
// Node at runtime (explicit .ts extension = native type stripping).
const PRODUCT_DISPATCH_SPECIFIER = "../../../apps/server/src/agent-team/dispatch.ts";
const PRODUCT_STRATEGIES_SPECIFIER = "../../../apps/server/src/agent-team/team-strategies.ts";

let dispatchModulePromise: Promise<ProductDispatchModule> | null = null;
let strategiesModulePromise: Promise<ProductStrategiesModule> | null = null;

async function loadDispatchModule(): Promise<ProductDispatchModule> {
  dispatchModulePromise ??= import(PRODUCT_DISPATCH_SPECIFIER) as Promise<ProductDispatchModule>;
  return dispatchModulePromise;
}

async function loadStrategiesModule(): Promise<ProductStrategiesModule> {
  strategiesModulePromise ??= import(PRODUCT_STRATEGIES_SPECIFIER) as Promise<ProductStrategiesModule>;
  return strategiesModulePromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMember(raw: unknown, index: number): MemberLike | null {
  void index;
  if (!isRecord(raw) || typeof raw.agentId !== "string") return null;
  const capabilities = isRecord(raw.capabilities) ? raw.capabilities : undefined;
  const role = typeof raw.role === "string" ? raw.role : undefined;
  return {
    agentId: raw.agentId,
    ...(capabilities ? { capabilities } : {}),
    ...(role ? { role } : {}),
  };
}

export async function runExpertOrchestrationCase(caseDef: GoldenCase): Promise<ExpertOrchestrationActual> {
  const input = caseDef.input;
  const members = Array.isArray(input.members)
    ? input.members.map(parseMember).filter((member): member is MemberLike => member !== null)
    : [];
  const teamId = typeof input.teamId === "string" ? input.teamId : "golden";
  const policy = isRecord(input.dispatchPolicy) ? (input.dispatchPolicy as unknown as DispatchPolicyLike) : null;

  const dispatch = await loadDispatchModule();
  const selected = policy && typeof policy.kind === "string" ? dispatch.selectMember(policy, members, teamId) : null;
  const eligibleAgents =
    policy && policy.kind === "capability-match" && isRecord(policy.required)
      ? dispatch.filterMembersByCapabilities(members, policy.required).map((member) => member.agentId)
      : members.map((member) => member.agentId);

  const actual: ExpertOrchestrationActual = {
    policyKind: policy?.kind ?? "none",
    selectedAgentId: selected?.agentId ?? null,
    eligibleAgents,
  };

  const strategy = typeof input.strategy === "string" ? input.strategy : null;
  if (strategy) {
    const strategies = await loadStrategiesModule();
    const meta = strategies.STRATEGY_META[strategy];
    if (meta) {
      actual.strategyMeta = {
        id: meta.id,
        complexity: meta.complexity,
        costLevel: meta.costLevel,
        qualityLevel: meta.qualityLevel,
      };
    }
  }
  return actual;
}
