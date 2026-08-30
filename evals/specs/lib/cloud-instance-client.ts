/**
 * Cloud instance client (L4 journey / cloud-instance flow).
 *
 * Models the approved script evals/voiceovers/cloud-instance.md: an org gets a
 * per-member Cloud instance in the browser that boots just in time, runs a
 * session, persists artifacts, sleeps, and wakes with its state intact.
 *
 * The client is injectable: `createCloudInstanceClient()` returns a mock state
 * machine by default (deterministic, runnable anywhere, used by the flow and
 * the stack spec), and a real HTTP client when OPENWORK_EVAL_DEN_API_URL is
 * set (real Den environment — the API contract below is the agreed surface;
 * calls fail loudly when the product side is not implemented yet, which is
 * itself the L4 signal).
 */
export type InstanceState =
  | "off" // Cloud exists but no instance is running
  | "provisioning" // instance is booting (just-in-time)
  | "ready" // booted, full UI available
  | "session" // user is actively working in a session
  | "sleeping" // idle; nothing runs
  | "waking"; // coming back from sleep

export interface CloudArtifact {
  name: string;
  path: string;
}

export interface CloudInstanceStatus {
  /** Org-level Cloud capability (admin toggled it on for this org). */
  cloudEnabled: boolean;
  /** Org the capability is scoped to. */
  orgId: string | null;
  instance: InstanceState;
  /** Org connections that carry over into the instance (frame 5). */
  connectionsReady: boolean;
  artifacts: CloudArtifact[];
}

export interface CloudInstanceClient {
  getStatus(): Promise<CloudInstanceStatus>;
  /** Platform admin turns Cloud on for one org (frame 2). */
  enableCloudForOrg(orgId: string): Promise<CloudInstanceStatus>;
  /** Open Cloud → boot an instance just in time (frame 4). */
  startInstance(): Promise<CloudInstanceStatus>;
  /** Ask something in a session — connections are already there (frame 5). */
  openSession(): Promise<CloudInstanceStatus>;
  /** Save a summary file to the workspace (frame 6). */
  saveArtifact(name: string, content: string): Promise<CloudInstanceStatus>;
  /** Close the tab; the instance puts itself to sleep (frame 7). */
  sleepInstance(): Promise<CloudInstanceStatus>;
  /** Reopen Cloud; the instance wakes with state intact (frame 8). */
  wakeInstance(): Promise<CloudInstanceStatus>;
}

// ---------------------------------------------------------------------------
// Mock client — deterministic state machine, no network.
// ---------------------------------------------------------------------------

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockCloudInstanceClient implements CloudInstanceClient {
  private orgId: string | null = null;
  private cloudEnabled = false;
  private instance: InstanceState = "off";
  private connectionsReady = false;
  private artifacts: CloudArtifact[] = [];

  private snapshot(): CloudInstanceStatus {
    return {
      cloudEnabled: this.cloudEnabled,
      orgId: this.orgId,
      instance: this.instance,
      connectionsReady: this.connectionsReady,
      artifacts: [...this.artifacts],
    };
  }

  private requireEnabled(action: string): void {
    if (!this.cloudEnabled) throw new Error(`${action} requires Cloud to be enabled for the org first`);
  }

  private requireInstance(...allowed: InstanceState[]): void {
    if (!allowed.includes(this.instance)) {
      throw new Error(`operation not allowed from instance state "${this.instance}"`);
    }
  }

  async getStatus(): Promise<CloudInstanceStatus> {
    return this.snapshot();
  }

  async enableCloudForOrg(orgId: string): Promise<CloudInstanceStatus> {
    this.orgId = orgId;
    this.cloudEnabled = true;
    // The org's connections (calendar, drive, ...) are provisioned alongside.
    this.connectionsReady = true;
    return this.snapshot();
  }

  async startInstance(): Promise<CloudInstanceStatus> {
    this.requireEnabled("startInstance");
    this.requireInstance("off");
    this.instance = "provisioning";
    await tick(25);
    this.instance = "ready";
    return this.snapshot();
  }

  async openSession(): Promise<CloudInstanceStatus> {
    this.requireEnabled("openSession");
    this.requireInstance("ready");
    this.instance = "session";
    return this.snapshot();
  }

  async saveArtifact(name: string, content: string): Promise<CloudInstanceStatus> {
    this.requireEnabled("saveArtifact");
    this.requireInstance("ready", "session");
    void content;
    this.artifacts.push({ name, path: `/workspace/cloud-instance/${name}` });
    return this.snapshot();
  }

  async sleepInstance(): Promise<CloudInstanceStatus> {
    this.requireEnabled("sleepInstance");
    this.requireInstance("ready", "session");
    this.instance = "sleeping";
    return this.snapshot();
  }

  async wakeInstance(): Promise<CloudInstanceStatus> {
    this.requireEnabled("wakeInstance");
    this.requireInstance("sleeping");
    this.instance = "waking";
    await tick(25);
    this.instance = "ready";
    // Artifacts survive sleep.
    return this.snapshot();
  }
}

// ---------------------------------------------------------------------------
// Real client — Den HTTP surface (used when OPENWORK_EVAL_DEN_API_URL is set).
// ---------------------------------------------------------------------------

function cleanBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

class DenCloudInstanceClient implements CloudInstanceClient {
  private readonly baseUrl: string;
  private readonly orgId: string;

  constructor(baseUrl: string, orgId: string) {
    this.baseUrl = baseUrl;
    this.orgId = orgId;
  }

  private async call(pathname: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      method: init?.method ?? "GET",
      headers: { "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Den cloud instance API ${pathname} failed: ${response.status} ${text.slice(0, 240)}`);
    }
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    return body;
  }

  private parseStatus(value: unknown): CloudInstanceStatus {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(`Den cloud instance returned an invalid status: ${JSON.stringify(value).slice(0, 240)}`);
    }
    const record = value as Record<string, unknown>;
    const instance = String(record.instance ?? "off") as InstanceState;
    const artifacts = Array.isArray(record.artifacts)
      ? (record.artifacts as Array<Record<string, unknown>>)
          .filter((entry) => typeof entry.name === "string" && typeof entry.path === "string")
          .map((entry) => ({ name: entry.name as string, path: entry.path as string }))
      : [];
    return {
      cloudEnabled: record.cloudEnabled === true,
      orgId: typeof record.orgId === "string" ? record.orgId : this.orgId,
      instance,
      connectionsReady: record.connectionsReady === true,
      artifacts,
    };
  }

  async getStatus(): Promise<CloudInstanceStatus> {
    return this.parseStatus(await this.call("/api/cloud/instance"));
  }

  async enableCloudForOrg(orgId: string): Promise<CloudInstanceStatus> {
    return this.parseStatus(
      await this.call(`/api/cloud/admin/orgs/${encodeURIComponent(orgId)}/enable`, {
        method: "POST",
        body: { orgId },
      }),
    );
  }

  async startInstance(): Promise<CloudInstanceStatus> {
    return this.parseStatus(await this.call("/api/cloud/instance/start", { method: "POST", body: {} }));
  }

  async openSession(): Promise<CloudInstanceStatus> {
    return this.parseStatus(await this.call("/api/cloud/instance/session", { method: "POST", body: {} }));
  }

  async saveArtifact(name: string, content: string): Promise<CloudInstanceStatus> {
    return this.parseStatus(
      await this.call("/api/cloud/instance/artifacts", { method: "POST", body: { name, content } }),
    );
  }

  async sleepInstance(): Promise<CloudInstanceStatus> {
    return this.parseStatus(await this.call("/api/cloud/instance/sleep", { method: "POST", body: {} }));
  }

  async wakeInstance(): Promise<CloudInstanceStatus> {
    return this.parseStatus(await this.call("/api/cloud/instance/wake", { method: "POST", body: {} }));
  }
}

/**
 * Default factory: mock unless a real Den environment is requested.
 *
 *   OPENWORK_EVAL_DEN_API_URL   — real Den API base URL
 *   OPENWORK_EVAL_CLOUD_ORG_ID  — org id for the Den client (default "eval-org")
 */
export function createCloudInstanceClient(
  env: NodeJS.ProcessEnv = process.env,
): CloudInstanceClient {
  const denUrl = env.OPENWORK_EVAL_DEN_API_URL?.trim();
  if (denUrl) {
    const orgId = env.OPENWORK_EVAL_CLOUD_ORG_ID?.trim() || "eval-org";
    return new DenCloudInstanceClient(cleanBaseUrl(denUrl), orgId);
  }
  return new MockCloudInstanceClient();
}
