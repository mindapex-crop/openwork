import { useCallback } from "react";

import { useLocal, type CollabMode } from "../../../kernel/local-provider";

export type { CollabMode } from "../../../kernel/local-provider";

export function useFeatureFlagsPreferences() {
  const { prefs, setPrefs } = useLocal();

  const microsandboxCreateSandboxEnabled =
    prefs.featureFlags?.microsandboxCreateSandbox === true;

  const toggleMicrosandboxCreateSandbox = useCallback(() => {
    setPrefs((previous) => ({
      ...previous,
      featureFlags: {
        ...previous.featureFlags,
        microsandboxCreateSandbox: !previous.featureFlags?.microsandboxCreateSandbox,
      },
    }));
  }, [setPrefs]);

  const memoryEnabled = prefs.featureFlags?.memory === true;

  const continuousEngineEnabled = prefs.featureFlags?.continuousEngine === true;

  const setContinuousEngine = useCallback((enabled: boolean) => {
    setPrefs((previous) => ({
      ...previous,
      featureFlags: {
        ...previous.featureFlags,
        continuousEngine: enabled,
      },
    }));
  }, [setPrefs]);

  const toggleMemory = useCallback(() => {
    setPrefs((previous) => ({
      ...previous,
      featureFlags: {
        ...previous.featureFlags,
        memory: !previous.featureFlags?.memory,
      },
    }));
  }, [setPrefs]);

  return {
    microsandboxCreateSandboxEnabled,
    toggleMicrosandboxCreateSandbox,
    continuousEngineEnabled,
    setContinuousEngine,
    memoryEnabled,
    toggleMemory,
  };
}

/**
 * Collaboration surface mode preference. Older persisted data may not contain
 * `collabMode` (shallow merge in LocalProvider), so treat anything other than
 * "cli" as the safe default "simple".
 */
export function useCollabMode(): {
  collabMode: CollabMode;
  setCollabMode: (mode: CollabMode) => void;
} {
  const { prefs, setPrefs } = useLocal();

  const storedMode = prefs.featureFlags?.collabMode;
  const collabMode: CollabMode =
    storedMode === "cli" || storedMode === "advanced" ? storedMode : "simple";

  const setCollabMode = useCallback(
    (mode: CollabMode) => {
      setPrefs((previous) => ({
        ...previous,
        featureFlags: {
          ...previous.featureFlags,
          collabMode: mode,
        },
      }));
    },
    [setPrefs],
  );

  return { collabMode, setCollabMode };
}
