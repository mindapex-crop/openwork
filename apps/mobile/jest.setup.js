/* eslint-env jest */
/* eslint-disable no-undef */

// AsyncStorage：官方 jest mock（原生模块在 Node 环境不可用）
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// expo-localization：设备语言检测在测试环境固定为 en
jest.mock("expo-localization", () => ({
  getLocales: () => [{ languageCode: "en", languageTag: "en-US" }],
}));

// react-native-safe-area-context：官方 jest mock
jest.mock("react-native-safe-area-context", () => {
  const mock = require("react-native-safe-area-context/jest/mock");
  return mock;
});

// react-native-screens：导航依赖原生模块，测试中渲染为普通组件
jest.mock("react-native-screens", () => {
  const React = require("react");
  const { View } = require("react-native");
  const mockScreens = Object.fromEntries(
    ["Screen", "ScreenContainer", "ScreenStack", "ScreenStackHeaderConfig"].map((name) => [
      name,
      (props) => React.createElement(View, props),
    ]),
  );
  return {
    __esModule: true,
    ...mockScreens,
    enableScreens: () => undefined,
    enableFreeze: () => undefined,
    isAvailable: () => false,
    screensEnabled: () => false,
  };
});
