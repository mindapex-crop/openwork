import { describe, expect, test } from "bun:test";

import {
  getComposerActions,
  registerComposerAction,
  unregisterComposerAction,
} from "../src/react-app/domains/session/surface/composer/composer-contributions";

function reset() {
  for (const id of getComposerActions("leading").concat(getComposerActions("trailing"))) {
    unregisterComposerAction(id.id);
  }
}

describe("composer contribution registry", () => {
  test("returns contributions for the requested slot only", () => {
    reset();
    registerComposerAction({ id: "a", slot: "leading", render: () => null });
    registerComposerAction({ id: "b", slot: "trailing", render: () => null });

    expect(getComposerActions("leading").map((a) => a.id)).toEqual(["a"]);
    expect(getComposerActions("trailing").map((a) => a.id)).toEqual(["b"]);
    reset();
  });

  test("orders by priority desc within a slot", () => {
    reset();
    registerComposerAction({ id: "low", slot: "leading", priority: 0, render: () => null });
    registerComposerAction({ id: "high", slot: "leading", priority: 10, render: () => null });
    registerComposerAction({ id: "default", slot: "leading", render: () => null });

    // Same priority keeps registration order (stable sort).
    expect(getComposerActions("leading").map((a) => a.id)).toEqual(["high", "low", "default"]);
    reset();
  });

  test("re-registering an id replaces the previous contribution", () => {
    reset();
    registerComposerAction({ id: "x", slot: "leading", priority: 1, render: () => null });
    registerComposerAction({ id: "x", slot: "leading", priority: 2, render: () => null });

    const actions = getComposerActions("leading");
    expect(actions).toHaveLength(1);
    expect(actions[0].priority).toEqual(2);
    reset();
  });

  test("unregister removes the contribution", () => {
    reset();
    registerComposerAction({ id: "y", slot: "leading", render: () => null });
    unregisterComposerAction("y");
    expect(getComposerActions("leading")).toHaveLength(0);
  });
});
