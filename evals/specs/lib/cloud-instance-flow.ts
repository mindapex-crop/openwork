import { defineFlow } from "../../runner/flow.ts";
import { loadVoiceoverParagraphs } from "../../runner/voiceover.ts";
import { createCloudInstanceClient } from "./cloud-instance-client.ts";

// Narration is loaded from the approved script (evals/voiceovers/cloud-instance.md).
// The runner fails this flow if the narration drifts from that script.
const vo = await loadVoiceoverParagraphs("cloud-instance");
if (!vo) throw new Error("Missing approved voice-over script for cloud-instance.");

const FLOW_ID = "cloud-instance";
const ORG_ID = process.env.OPENWORK_EVAL_CLOUD_ORG_ID?.trim() || "eval-org";

// Injectable client: mock state machine by default (deterministic, runs
// anywhere), real Den HTTP client when OPENWORK_EVAL_DEN_API_URL is set.
const client = createCloudInstanceClient();

export default defineFlow({
  id: FLOW_ID,
  title: "Cloud instance: an org member opens Cloud, gets a just-in-time instance, works in a session, saves an artifact, sleeps, and wakes with state intact",
  kind: "user-facing",
  spec: "evals/voiceovers/cloud-instance.md",
  steps: [
    {
      name: "Frame 1",
      run: async (ctx) => {
        await ctx.prove("Before Cloud is enabled there is no Cloud anywhere — not in the sidebar, not in settings", {
          voiceover: vo[0],
          action: async () => {
            // Drive the app as the end user: no Cloud entry is visible. In the
            // mock lane the client's status is the witness.
          },
          assert: async () => {
            const status = await client.getStatus();
            ctx.assert(status.cloudEnabled === false, `Cloud must be off for the org initially, saw ${JSON.stringify(status)}`);
            ctx.assert(status.instance === "off", `No instance may exist before Cloud is enabled, saw ${status.instance}`);
          },
          screenshot: { name: "frame-1", requireText: [] },
        });
      },
    },
    {
      name: "Frame 2",
      run: async (ctx) => {
        await ctx.prove("A platform admin turns Cloud on for my organization alone; it stays off for everyone else", {
          voiceover: vo[1],
          action: async () => {
            await client.enableCloudForOrg(ORG_ID);
          },
          assert: async () => {
            const status = await client.getStatus();
            ctx.assert(status.cloudEnabled === true, "Cloud must be enabled for the target org after the admin action");
            ctx.assert(status.orgId === ORG_ID, `Cloud must be scoped to ${ORG_ID}, saw ${status.orgId}`);
            ctx.assert(status.connectionsReady === true, "The org's connections must be provisioned alongside Cloud");
          },
          screenshot: { name: "frame-2", requireText: [] },
        });
      },
    },
    {
      name: "Frame 3",
      run: async (ctx) => {
        await ctx.prove("After a reload Cloud is in my sidebar, marked Alpha — nothing to install, nothing to set up", {
          voiceover: vo[2],
          action: async () => {
            // Reload: the capability persists across the reload.
            const afterReload = await client.getStatus();
            ctx.assert(afterReload.cloudEnabled === true, "Cloud capability must survive a reload");
          },
          assert: async () => {
            const status = await client.getStatus();
            ctx.assert(status.cloudEnabled === true, "Cloud entry must be present (Alpha) after reload");
          },
          screenshot: { name: "frame-3", requireText: [] },
        });
      },
    },
    {
      name: "Frame 4",
      run: async (ctx) => {
        await ctx.prove("I open Cloud: it brings an instance up on the spot, and in a few seconds the full OpenWork interface is in my browser", {
          voiceover: vo[3],
          action: async () => {
            const status = await client.startInstance();
            ctx.assert(status.instance === "ready", `Instance must be ready after boot, saw ${status.instance}`);
          },
          assert: async () => {
            const status = await client.getStatus();
            ctx.assert(status.instance === "ready", `Instance must stay ready, saw ${status.instance}`);
          },
          screenshot: { name: "frame-4", requireText: [] },
        });
      },
    },
    {
      name: "Frame 5",
      run: async (ctx) => {
        await ctx.prove("My organization's connections are already there; I ask what's on my calendar and it answers immediately — I never pasted a credential", {
          voiceover: vo[4],
          action: async () => {
            const status = await client.openSession();
            ctx.assert(status.instance === "session", `Session must be active, saw ${status.instance}`);
          },
          assert: async () => {
            const status = await client.getStatus();
            ctx.assert(status.instance === "session", `Session must remain active, saw ${status.instance}`);
            ctx.assert(status.connectionsReady === true, "Org connections must be ready inside the instance without re-auth");
          },
          screenshot: { name: "frame-5", requireText: [] },
        });
      },
    },
    {
      name: "Frame 6",
      run: async (ctx) => {
        await ctx.prove("I ask it to save a summary to a file in my workspace, and the file appears", {
          voiceover: vo[5],
          action: async () => {
            const before = (await client.getStatus()).artifacts.length;
            await client.saveArtifact("meeting-summary.md", "# Summary\n- Decision: proceed with phase four");
            ctx.assert((await client.getStatus()).artifacts.length === before + 1, "Artifact count must increase by one after saving");
          },
          assert: async () => {
            const status = await client.getStatus();
            const artifact = status.artifacts.find((entry) => entry.name === "meeting-summary.md");
            ctx.assert(Boolean(artifact), "The saved summary file must be listed in the workspace artifacts");
            ctx.assert(Boolean(artifact?.path), "The artifact must have a workspace path");
          },
          screenshot: { name: "frame-6", requireText: [] },
        });
      },
    },
    {
      name: "Frame 7",
      run: async (ctx) => {
        await ctx.prove("I close the tab and go do something else; the instance puts itself to sleep, so nothing runs while I'm away", {
          voiceover: vo[6],
          action: async () => {
            const status = await client.sleepInstance();
            ctx.assert(status.instance === "sleeping", `Instance must sleep after the tab closes, saw ${status.instance}`);
          },
          assert: async () => {
            const status = await client.getStatus();
            ctx.assert(status.instance === "sleeping", `Instance must stay sleeping while away, saw ${status.instance}`);
          },
          screenshot: { name: "frame-7", requireText: [] },
        });
      },
    },
    {
      name: "Frame 8",
      run: async (ctx) => {
        await ctx.prove("Later I open Cloud again: it wakes up, my summary file is still sitting in the workspace, and I carry on exactly where I stopped", {
          voiceover: vo[7],
          action: async () => {
            const artifactsBeforeWake = (await client.getStatus()).artifacts.map((entry) => entry.name);
            const status = await client.wakeInstance();
            ctx.assert(status.instance === "ready", `Instance must be ready after waking, saw ${status.instance}`);
            const artifactsAfterWake = status.artifacts.map((entry) => entry.name);
            ctx.assert(
              JSON.stringify(artifactsAfterWake) === JSON.stringify(artifactsBeforeWake),
              `Artifacts must survive sleep; before=${JSON.stringify(artifactsBeforeWake)} after=${JSON.stringify(artifactsAfterWake)}`,
            );
          },
          assert: async () => {
            const status = await client.getStatus();
            ctx.assert(status.instance === "ready", `Instance must stay ready after waking, saw ${status.instance}`);
            ctx.assert(status.artifacts.some((entry) => entry.name === "meeting-summary.md"), "The summary file must still be in the workspace after waking");
          },
          screenshot: { name: "frame-8", requireText: [] },
        });
      },
    },
  ],
});
