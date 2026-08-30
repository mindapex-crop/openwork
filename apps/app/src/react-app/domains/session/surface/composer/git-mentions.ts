import type { MentionOption } from "./mention-types";

/**
 * "@Git" mentions reference uncommitted changes or recent commits.
 * Values: "unstaged", "staged", or "commit:<sha>".
 */

export type GitChangeType = "added" | "modified" | "deleted" | "renamed";

export interface GitChange {
  filePath: string;
  changeType: GitChangeType;
}

export interface GitCommit {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
}

/** List uncommitted-change mention options. */
export function listGitUnstaged(changes: GitChange[]): MentionOption[] {
  if (changes.length === 0) return [];
  return [
    {
      id: "git:unstaged",
      kind: "git",
      value: "unstaged",
      label: "Unstaged changes",
      description: `${changes.length} file${changes.length === 1 ? "" : "s"} changed`,
      icon: "GitBranch",
    },
    ...changes.slice(0, 5).map((change) => ({
      id: `git:file:${change.filePath}`,
      kind: "git" as const,
      value: `file:${change.filePath}`,
      label: change.filePath.split(/[\\/]/).pop() || change.filePath,
      description: `${change.changeType} · ${change.filePath}`,
      icon: "FileDiff" as const,
    })),
  ];
}

/** List recent-commit mention options. */
export function listGitCommits(commits: GitCommit[]): MentionOption[] {
  return commits.map((commit) => ({
    id: `git:commit:${commit.sha}`,
    kind: "git",
    value: `commit:${commit.sha}`,
    label: commit.message.split("\n")[0].slice(0, 60),
    description: `${commit.sha.slice(0, 7)} · ${commit.author}`,
    icon: "GitCommitHorizontal",
  }));
}

/** Combined git mention listing. */
export function listGitMentions(changes: GitChange[], commits: GitCommit[]): MentionOption[] {
  return [...listGitUnstaged(changes), ...listGitCommits(commits)];
}
