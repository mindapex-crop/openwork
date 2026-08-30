module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.ts?(x)", "**/?(*.)+(test).ts?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
  transformIgnorePatterns: [
    // 注意：pnpm 会把依赖装在 node_modules/.pnpm/... 下，白名单必须包含 .pnpm，
    // 否则 @react-native/jest-preset 的 setup.js（ESM）不会被 babel-jest 转换。
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|\\.pnpm|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@react-native-async-storage/.*|react-native-screens|react-native-safe-area-context))",
  ],
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "!src/**/*.d.ts"],
  coveragePathIgnorePatterns: ["/node_modules/", "/src/navigation/"],
};
