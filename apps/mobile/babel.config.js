// 解析 babel-preset-expo 依赖树内的 babel 插件（本工程非直接依赖，需从 preset 的
// 依赖目录解析，避免 pnpm 严格 node_modules 下找不到）。
function pluginFromBabelPresetExpo(name) {
  return require.resolve(name, { paths: [require.resolve("babel-preset-expo")] });
}

module.exports = function (api) {
  api.cache(true);

  // jest-expo 的 transform 会把 babel caller 设为 metro，babel-preset-expo 在
  // metro caller 下保留 ESM 输出；jest 29 的 Node 运行时无法执行 ESM，导致
  // @react-native/jest-preset 的 setup.js 报 "Cannot use import statement outside a module"。
  // 这里在 jest 环境（NODE_ENV=test）时强制转 CommonJS。
  // 注意：不能用 api.env()/api.caller()——jest-expo 通过 `extends` 指向本文件且
  // configFile 也为 true，导致配置被加载两次，api.env() 会抛
  // "Caching has already been configured with .never or .forever()"。
  const isJest = process.env.NODE_ENV === "test";

  return {
    presets: ["babel-preset-expo"],
    plugins: isJest ? [[pluginFromBabelPresetExpo("@babel/plugin-transform-modules-commonjs")]] : [],
  };
};
