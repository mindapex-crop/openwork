import { afterEach, describe, expect, test } from "bun:test";

import { useDeviceStore } from "../src/react-app/domains/devices/device-store";

type FetchLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

function mockFetch(body: unknown, ok = true, status = 200): void {
  globalThis.fetch = (async () =>
    ({ ok, status, json: async () => body }) as FetchLike) as unknown as typeof fetch;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  useDeviceStore.setState({
    devices: [],
    pairCode: null,
    pairCodeExpiresInSeconds: 0,
    loading: false,
    error: null,
    locked: false,
    activeControlCommand: null,
  });
});

describe("useDeviceStore — 多设备远程控制前端 store", () => {
  test("fetchDevices 加载已配对设备列表", async () => {
    mockFetch({
      devices: [
        { deviceId: "dev_1", name: "iPhone", platform: "ios", pairedAt: 1000, lastSeenAt: 2000, active: true, remoteControlActive: false },
      ],
    });
    await useDeviceStore.getState().fetchDevices();
    expect(useDeviceStore.getState().devices).toHaveLength(1);
    expect(useDeviceStore.getState().devices[0]).toMatchObject({ name: "iPhone", platform: "ios" });
    expect(useDeviceStore.getState().error).toBeNull();
  });

  test("issuePairCode 生成配对码", async () => {
    mockFetch({ pairCode: "ABC234", expiresInSeconds: 60 });
    await useDeviceStore.getState().issuePairCode();
    expect(useDeviceStore.getState().pairCode).toBe("ABC234");
    expect(useDeviceStore.getState().pairCodeExpiresInSeconds).toBe(60);
    expect(useDeviceStore.getState().loading).toBe(false);
  });

  test("revokeDevice 从列表中移除设备", async () => {
    useDeviceStore.setState({
      devices: [
        { deviceId: "dev_1", name: "iPhone", platform: "ios", pairedAt: 1000, lastSeenAt: 2000, active: true, remoteControlActive: false },
        { deviceId: "dev_2", name: "iPad", platform: "ios", pairedAt: 3000, lastSeenAt: 4000, active: true, remoteControlActive: false },
      ],
    });
    mockFetch({ revoked: true, deviceId: "dev_1" });
    await useDeviceStore.getState().revokeDevice("dev_1");
    expect(useDeviceStore.getState().devices).toHaveLength(1);
    expect(useDeviceStore.getState().devices[0].deviceId).toBe("dev_2");
  });

  test("pollControlCommands 收到 lock 指令 → locked = true", async () => {
    mockFetch({
      commands: [
        { commandId: "cmd_1", deviceId: "dev_1", command: "lock", threadId: null, note: null, status: "pending", createdAt: 1000, executedAt: null },
      ],
    });
    await useDeviceStore.getState().pollControlCommands();
    expect(useDeviceStore.getState().locked).toBe(true);
    expect(useDeviceStore.getState().activeControlCommand?.command).toBe("lock");
  });

  test("pollControlCommands 收到 unlock 指令 → locked = false", async () => {
    useDeviceStore.setState({ locked: true });
    mockFetch({
      commands: [
        { commandId: "cmd_2", deviceId: "dev_1", command: "unlock", threadId: null, note: null, status: "pending", createdAt: 1000, executedAt: null },
      ],
    });
    await useDeviceStore.getState().pollControlCommands();
    expect(useDeviceStore.getState().locked).toBe(false);
  });

  test("pollControlCommands 无指令 → activeControlCommand = null", async () => {
    mockFetch({ commands: [] });
    await useDeviceStore.getState().pollControlCommands();
    expect(useDeviceStore.getState().activeControlCommand).toBeNull();
  });

  test("ackCommand 确认后清空 activeControlCommand", async () => {
    useDeviceStore.setState({
      activeControlCommand: {
        commandId: "cmd_1",
        deviceId: "dev_1",
        command: "lock",
        threadId: null,
        note: null,
        status: "pending",
        createdAt: 1000,
        executedAt: null,
      },
    });
    mockFetch({ ok: true, commandId: "cmd_1" });
    await useDeviceStore.getState().ackCommand("cmd_1", "executed");
    expect(useDeviceStore.getState().activeControlCommand).toBeNull();
  });

  test("fetchDevices 网络错误 → 设置 error", async () => {
    mockFetch({ message: "Network error" }, false, 500);
    await useDeviceStore.getState().fetchDevices();
    expect(useDeviceStore.getState().error).toBe("Network error");
  });

  test("fetchDevices 收到缺少 devices 字段的响应 → 归一化为空列表（不污染为 undefined）", async () => {
    useDeviceStore.setState({
      devices: [
        { deviceId: "dev_1", name: "iPhone", platform: "ios", pairedAt: 1000, lastSeenAt: 2000, active: true, remoteControlActive: false },
      ],
    });
    mockFetch({});
    await useDeviceStore.getState().fetchDevices();
    expect(useDeviceStore.getState().devices).toEqual([]);
    expect(useDeviceStore.getState().error).toBeNull();
  });
});