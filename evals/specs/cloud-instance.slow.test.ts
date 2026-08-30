import { expect } from "vitest";
import { test } from "@openwork/testkit";
import { MockCloudInstanceClient, createCloudInstanceClient } from "./lib/cloud-instance-client.ts";
import type { FlowContext, Evidence } from "../runner/flow.ts";
import type { SurfaceFacade } from "../runner/surfaces.ts";
import flowDefinition from "./lib/cloud-instance-flow.ts";

/**
 * Cloud instance journey (approved script: evals/voiceovers/cloud-instance.md).
 *
 * Runs the full 8-frame flow against the injectable cloud-instance client. The
 * mock client is the default, so this stack spec is runnable anywhere without
 * an app or a Den environment; set OPENWORK_EVAL_DEN_API_URL to exercise the
 * real HTTP client instead.
 */

test("the mock cloud instance client follows the approved state machine", async ({ evidence }) => {
  const client = new MockCloudInstanceClient();

  // Frame 1: nothing exists before Cloud is enabled.
  const initial = await client.getStatus();
  expect(initial.cloudEnabled).toBe(false);
  expect(initial.instance).toBe("off");

  // Frame 2: admin enables Cloud for one org; connections provision along.
  const enabled = await client.enableCloudForOrg("eval-org");
  expect(enabled.cloudEnabled).toBe(true);
  expect(enabled.orgId).toBe("eval-org");
  expect(enabled.connectionsReady).toBe(true);

  // Frame 4: open Cloud → boot just in time → ready.
  const started = await client.startInstance();
  expect(started.instance).toBe("ready");

  // Frame 5: session with org connections already present.
  const session = await client.openSession();
  expect(session.instance).toBe("session");
  expect(session.connectionsReady).toBe(true);

  // Frame 6: artifact lands in the workspace.
  const saved = await client.saveArtifact("meeting-summary.md", "# Summary");
  expect(saved.artifacts.map((entry) => entry.name)).toContain("meeting-summary.md");

  // Frame 7: tab closes → sleep.
  const sleeping = await client.sleepInstance();
  expect(sleeping.instance).toBe("sleeping");

  // Frame 8: reopen → wake with artifacts intact.
  const woken = await client.wakeInstance();
  expect(woken.instance).toBe("ready");
  expect(woken.artifacts.map((entry) => entry.name)).toContain("meeting-summary.md");

  evidence.fact(
    "Mock cloud instance client walks the full off→provisioning→ready→session→sleeping→waking→ready journey",
    "Every transition the approved script narrates is enforced by the state machine; artifacts survive sleep.",
    true,
  );
});

test("the mock client rejects illegal state transitions loudly", async ({ evidence }) => {
  const client = new MockCloudInstanceClient();
  await expect(client.startInstance()).rejects.toThrow(/requires Cloud to be enabled/);
  await client.enableCloudForOrg("eval-org");
  await client.startInstance();
  await client.openSession();
  await expect(client.wakeInstance()).rejects.toThrow(/not allowed from instance state "session"/);
  evidence.fact(
    "Invalid transitions fail with actionable messages",
    "Starting before enable and waking from a non-sleeping state both reject instead of corrupting the state machine.",
    true,
  );
});

function makeFakeContext(): FlowContext {
  return {
    flowId: "cloud-instance",
    env: process.env,
    cdpBaseUrl: null,
    outDir: "",
    client: null,
    logs: [],
    screenshots: [],
    evidenceFrames: [],
    state: {},
    surfaces: {} as SurfaceFacade,
    eval: async () => null,
    // The real runner throws on a failed assertion; mirror that so a frame
    // failure surfaces as a test failure with the assertion message.
    assert: (condition, message) => {
      if (!condition) throw new Error(message);
    },
    skip: () => {},
    log: () => {},
    output: () => ({ type: "output", name: "", text: "" }),
    prove: async (_name, options) => {
      await options?.action?.();
      await options?.assert?.();
    },
    recordEvidence: (entry: Evidence) => entry,
    waitFor: async () => null,
    waitForText: async () => {},
    waitForRoute: async () => "",
    expectRoute: async () => ({ type: "assertion", status: "passed", assertion: "" }),
    hasText: async () => true,
    clickText: async () => null,
    trustedClick: async () => undefined,
    fill: async () => {},
    navigateHash: async () => {},
    control: async () => null,
    expectText: async () => ({ type: "assertion", status: "passed", assertion: "" }),
    expectNoText: async () => ({ type: "assertion", status: "passed", assertion: "" }),
    expectHashIncludes: async () => {},
    screenshot: async () => "",
    // never-typed stubs satisfy the FlowContext surface without importing the
    // runner's CDP/surface type graphs.
    on: async () => undefined as never,
    switchToNewTab: async () => undefined as never,
    switchBack: async () => {},
    reconnect: async () => undefined as never,
    ensureLightMode: async () => {},
    beginStep: () => {},
    endStep: () => [],
  };
}

test("the cloud-instance flow runs all eight approved frames green against the injectable client", async ({ evidence }) => {
  const flow = flowDefinition;
  expect(flow.id).toBe("cloud-instance");
  expect(flow.steps.length).toBe(8);

  const ctx = makeFakeContext();
  for (const step of flow.steps) {
    await step.run(ctx);
  }

  evidence.fact(
    "All 8 cloud-instance frames pass against the mock client",
    "The flow's state transitions (off→ready→session→sleeping→waking) and artifact persistence assert cleanly; the flow also guards its approved voice-over script.",
    true,
  );
});

test("the default client factory is the mock unless a real Den URL is configured", async ({ evidence }) => {
  const mockEnv = { ...process.env, OPENWORK_EVAL_DEN_API_URL: undefined };
  const mockClient = createCloudInstanceClient(mockEnv);
  expect(mockClient).toBeInstanceOf(MockCloudInstanceClient);

  const realEnv = { ...process.env, OPENWORK_EVAL_DEN_API_URL: "https://den.example" };
  const realClient = createCloudInstanceClient(realEnv);
  expect(realClient).not.toBeInstanceOf(MockCloudInstanceClient);

  evidence.fact(
    "The client factory switches on OPENWORK_EVAL_DEN_API_URL",
    "Default lane is the deterministic mock; the real Den HTTP client is selected only when the env var is set.",
    true,
  );
});
