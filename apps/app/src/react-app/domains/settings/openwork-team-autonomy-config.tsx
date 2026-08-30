/** @jsxImportSource react */
import { Kanban } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { registerExtensionConfig } from "./extension-registry";

const openWorkTeamAutonomyConfigFactory = () => (
  <Card variant="outline" size="sm">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Kanban size={16} />
        Team Autonomy
      </CardTitle>
      <CardDescription>
        Multi-agent teams: decompose a task into subtasks, run them in parallel with the CLI
        agents installed on this machine, and follow each subtask's status and output.
      </CardDescription>
    </CardHeader>
    <div className="space-y-3 px-4 pb-4">
      <Alert>
        <AlertTitle>What running needs</AlertTitle>
        <AlertDescription>
          Team Mode talks to the <code>/teams</code> routes on the local openwork-server — no
          Enterprise build and no environment variable. Running a task spawns the CLI agents
          installed on this machine (<code>opencode</code>, <code>kimi</code>,{" "}
          <code>claude-code</code>, <code>codex</code>, …); with none available Run answers{" "}
          <code>no_agent_available</code>. Fan-out multiplies token usage — the wider the
          strategy, the more agents run at once.
        </AlertDescription>
      </Alert>
    </div>
  </Card>
);

registerExtensionConfig("openwork.teamAutonomy.settings", openWorkTeamAutonomyConfigFactory);
registerExtensionConfig("openwork-team-autonomy", openWorkTeamAutonomyConfigFactory);