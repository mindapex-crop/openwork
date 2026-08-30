import "./_setup/localstorage";
import { afterEach, describe, expect, test } from "bun:test";

import {
  advanceGoalTurn,
  buildGoalSystemBlock,
  formatGoalProgress,
  GOAL_MARKER,
  makeGoal,
  parseGoalCommand,
  remainingGoalTurns,
} from "../src/react-app/domains/session/surface/composer/composer-goal";
import {
  advanceSessionGoalTurn,
  applyGoalCommand,
  clearSessionGoal,
  getSessionGoal,
  setSessionGoal,
  useSessionGoalStore,
} from "../src/react-app/domains/session/surface/composer/composer-goal-store";

function resetStore() {
  useSessionGoalStore.setState({ goals: {} });
}

afterEach(() => {
  resetStore();
});

describe("parseGoalCommand（/goal 参数解析）", () => {
  test("空白参数 → 查询状态", () => {
    expect(parseGoalCommand(undefined).kind).toBe("status");
    expect(parseGoalCommand(null).kind).toBe("status");
    expect(parseGoalCommand("").kind).toBe("status");
    expect(parseGoalCommand("   ").kind).toBe("status");
  });

  test("中英文状态词各自映射到对应迁移", () => {
    expect(parseGoalCommand("clear").kind).toBe("clear");
    expect(parseGoalCommand("  OFF ").kind).toBe("clear");
    expect(parseGoalCommand("清除").kind).toBe("clear");
    expect(parseGoalCommand("complete").kind).toBe("complete");
    expect(parseGoalCommand("完成").kind).toBe("complete");
    expect(parseGoalCommand("block").kind).toBe("block");
    expect(parseGoalCommand("受阻").kind).toBe("block");
    expect(parseGoalCommand("resume").kind).toBe("resume");
    expect(parseGoalCommand("继续").kind).toBe("resume");
  });

  test("状态查询词不会误建目标", () => {
    for (const args of ["status", "STATUS", "progress", "状态", "进度"]) {
      expect(parseGoalCommand(args).kind).toBe("status");
    }
  });

  test("普通文本 → set，轮次从 0 起、状态进行中", () => {
    const command = parseGoalCommand("完成登录模块重构");
    expect(command.kind).toBe("set");
    if (command.kind !== "set") return;
    expect(command.goal).toEqual({ objective: "完成登录模块重构", status: "active", turns: 0, maxTurns: null });
  });

  test("三种预算写法都被剥离出目标文本", () => {
    expect(parseGoalCommand("ship the dashboard --turns 5")).toEqual({
      kind: "set",
      goal: makeGoal("ship the dashboard", 5),
    });
    expect(parseGoalCommand("ship the dashboard in 5 turns")).toEqual({
      kind: "set",
      goal: makeGoal("ship the dashboard", 5),
    });
    expect(parseGoalCommand("上线看板 5 轮内")).toEqual({
      kind: "set",
      goal: makeGoal("上线看板", 5),
    });
    expect(parseGoalCommand("上线看板5轮内")).toEqual({
      kind: "set",
      goal: makeGoal("上线看板", 5),
    });
  });

  test("预算夹到合法区间，非法数字视为无预算", () => {
    const clamp = (args: string) => {
      const command = parseGoalCommand(args);
      return command.kind === "set" ? command.goal.maxTurns : null;
    };
    expect(clamp("目标 --turns 0")).toBe(1);
    expect(clamp("目标 --turns 9999")).toBe(100);
    expect(clamp("目标 --turns abc")).toBe(null);
  });

  test("只剩预算没有目标文本 → 查询状态而非设定空目标", () => {
    expect(parseGoalCommand("--turns 5").kind).toBe("status");
  });

  test("含状态词的自然语言目标不被误判为迁移命令", () => {
    const command = parseGoalCommand("清理旧数据");
    expect(command.kind).toBe("set");
    expect(parseGoalCommand("check the status page").kind).toBe("set");
  });
});

describe("advanceGoalTurn（轮次预算）", () => {
  test("无目标 / 空白返回 null", () => {
    expect(advanceGoalTurn(null)).toBeNull();
    expect(advanceGoalTurn(undefined)).toBeNull();
  });

  test("不限预算时只累加，永不受阻", () => {
    let goal = makeGoal("持续目标");
    for (let i = 1; i <= 20; i++) {
      const advanced = advanceGoalTurn(goal);
      expect(advanced).not.toBeNull();
      goal = advanced!;
      expect(goal.turns).toBe(i);
      expect(goal.status).toBe("active");
    }
  });

  test("用满预算的那一轮仍有效，超出的一轮才受阻", () => {
    let goal = makeGoal("五轮内上线", 5);
    for (let i = 1; i <= 5; i++) {
      goal = advanceGoalTurn(goal)!;
      expect(goal.status).toBe("active");
    }
    expect(goal.turns).toBe(5);
    goal = advanceGoalTurn(goal)!;
    expect(goal.turns).toBe(6);
    expect(goal.status).toBe("blocked");
  });

  test("单轮预算也给出一轮有效工作", () => {
    const goal = makeGoal("一轮搞定", 1);
    expect(advanceGoalTurn(goal)!.status).toBe("active");
    expect(advanceGoalTurn(advanceGoalTurn(goal))!.status).toBe("blocked");
  });

  test("受阻或已完成的目标不再推进", () => {
    const blocked = { ...makeGoal("受阻目标", 2), status: "blocked" as const, turns: 3 };
    expect(advanceGoalTurn(blocked)).toBe(blocked);
    const done = { ...makeGoal("已完成"), status: "complete" as const, turns: 4 };
    expect(advanceGoalTurn(done)).toBe(done);
  });

  test("推进返回新对象，不改动传入记录", () => {
    const goal = makeGoal("不可变");
    const advanced = advanceGoalTurn(goal)!;
    expect(goal.turns).toBe(0);
    expect(advanced).not.toBe(goal);
  });
});

describe("进度标签", () => {
  test("无预算只显示已用轮次，有预算显示分数", () => {
    expect(formatGoalProgress(makeGoal("a"))).toBe("0");
    expect(formatGoalProgress({ ...makeGoal("a"), turns: 3 })).toBe("3");
    expect(formatGoalProgress(makeGoal("a", 10))).toBe("0/10");
    expect(formatGoalProgress({ ...makeGoal("a", 10), turns: 3 })).toBe("3/10");
  });

  test("受阻推进到预算外一轮时，展示夹到预算上限", () => {
    const over = { ...makeGoal("a", 5), turns: 6, status: "blocked" as const };
    expect(formatGoalProgress(over)).toBe("5/5");
    expect(buildGoalSystemBlock(over)).toContain("turn 5 of 5");
  });

  test("剩余轮次不为负", () => {
    expect(remainingGoalTurns(makeGoal("a", 3))).toBe(3);
    expect(remainingGoalTurns({ ...makeGoal("a", 3), turns: 5 })).toBe(0);
    expect(remainingGoalTurns(makeGoal("a"))).toBeNull();
  });
});

describe("buildGoalSystemBlock（按状态框定系统上下文）", () => {
  test("无目标返回 null", () => {
    expect(buildGoalSystemBlock(null)).toBeNull();
    expect(buildGoalSystemBlock(undefined)).toBeNull();
    expect(buildGoalSystemBlock({ objective: "   ", status: "active", turns: 0, maxTurns: null })).toBeNull();
  });

  test("进行中：含标记、目标文本与轮次进度", () => {
    const block = buildGoalSystemBlock({ ...makeGoal("完成登录模块重构", 8), turns: 2 });
    expect(block).toContain(GOAL_MARKER);
    expect(block).toContain('Active goal for this session: "完成登录模块重构"');
    expect(block).toContain("turn 2 of 8");
    expect(block).toContain("/goal clear");
  });

  test("已完成：不再注入，避免继续约束会话", () => {
    expect(buildGoalSystemBlock({ ...makeGoal("已达成"), status: "complete" })).toBeNull();
  });

  test("受阻：要求说明所需信息，而不是继续推进", () => {
    const block = buildGoalSystemBlock({ ...makeGoal("缺凭据", 3), turns: 4, status: "blocked" });
    expect(block).toContain(GOAL_MARKER);
    expect(block).toContain('Goal "缺凭据" is blocked');
    expect(block).toContain("Summarize the blocker");
    expect(block).not.toContain("Active goal for this session");
  });

  test("目标文本自带标记时幂等返回 null", () => {
    expect(buildGoalSystemBlock(makeGoal(`${GOAL_MARKER} something`))).toBeNull();
  });
});

describe("目标 store（按会话隔离、跨轮持续）", () => {
  test("applyGoalCommand set 写入指定会话且隔离", () => {
    applyGoalCommand("s1", parseGoalCommand("目标 A"));
    applyGoalCommand("s2", parseGoalCommand("目标 B --turns 4"));
    expect(getSessionGoal("s1")?.objective).toBe("目标 A");
    expect(getSessionGoal("s2")).toEqual({ objective: "目标 B", status: "active", turns: 0, maxTurns: 4 });
  });

  test("重复 set 覆盖旧目标并重置轮次计数", () => {
    setSessionGoal("s1", { ...makeGoal("旧目标", 9), turns: 7 });
    applyGoalCommand("s1", parseGoalCommand("新目标"));
    expect(getSessionGoal("s1")).toEqual({ objective: "新目标", status: "active", turns: 0, maxTurns: null });
  });

  test("complete / block / resume 只改状态，保留目标与计数", () => {
    setSessionGoal("s1", { ...makeGoal("重构", 6), turns: 2 });
    applyGoalCommand("s1", { kind: "block" });
    expect(getSessionGoal("s1")).toEqual({ objective: "重构", status: "blocked", turns: 2, maxTurns: 6 });
    applyGoalCommand("s1", { kind: "resume" });
    expect(getSessionGoal("s1")).toEqual({ objective: "重构", status: "active", turns: 2, maxTurns: 6 });
    applyGoalCommand("s1", { kind: "complete" });
    expect(getSessionGoal("s1")?.status).toBe("complete");
  });

  test("无目标时的状态迁移是空操作", () => {
    applyGoalCommand("missing", { kind: "complete" });
    applyGoalCommand("missing", { kind: "block" });
    applyGoalCommand("missing", { kind: "resume" });
    expect(getSessionGoal("missing")).toBeNull();
  });

  test("clear 只清除目标会话", () => {
    applyGoalCommand("s1", parseGoalCommand("目标 A"));
    applyGoalCommand("s2", parseGoalCommand("目标 B"));
    clearSessionGoal("s1");
    expect(getSessionGoal("s1")).toBeNull();
    expect(getSessionGoal("s2")?.objective).toBe("目标 B");
  });

  test("清除不存在的会话保持 store 引用不变", () => {
    const before = useSessionGoalStore.getState().goals;
    clearSessionGoal("missing");
    expect(useSessionGoalStore.getState().goals).toBe(before);
  });

  test("status 命令不改动 store", () => {
    setSessionGoal("s1", makeGoal("不动"));
    const before = useSessionGoalStore.getState().goals;
    applyGoalCommand("s1", { kind: "status" });
    expect(useSessionGoalStore.getState().goals).toBe(before);
  });

  test("跨轮发送持续计数，越界那一刻转为受阻", () => {
    applyGoalCommand("s1", parseGoalCommand("三轮内完成 --turns 3"));
    expect(advanceSessionGoalTurn("s1")?.turns).toBe(1);
    expect(advanceSessionGoalTurn("s1")?.status).toBe("active");
    expect(advanceSessionGoalTurn("s1")?.status).toBe("active");
    const exhausted = advanceSessionGoalTurn("s1");
    expect(exhausted?.status).toBe("blocked");
    expect(formatGoalProgress(exhausted!)).toBe("3/3");
  });

  test("无目标时轮次推进返回 null 且不写入 store", () => {
    const before = useSessionGoalStore.getState().goals;
    expect(advanceSessionGoalTurn("missing")).toBeNull();
    expect(useSessionGoalStore.getState().goals).toBe(before);
  });

  test("已完成的目标不再计入轮次，也不触发写入", () => {
    setSessionGoal("s1", { ...makeGoal("已达成", 5), status: "complete", turns: 2 });
    const before = useSessionGoalStore.getState().goals;
    const result = advanceSessionGoalTurn("s1");
    expect(result?.turns).toBe(2);
    expect(useSessionGoalStore.getState().goals).toBe(before);
  });

  test("目标在多次读取之间持续存在", () => {
    applyGoalCommand("s1", parseGoalCommand("持续目标"));
    expect(getSessionGoal("s1")?.objective).toBe("持续目标");
    expect(getSessionGoal("s1")?.objective).toBe("持续目标");
  });
});
