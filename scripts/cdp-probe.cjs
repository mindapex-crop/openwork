const WebSocket = require("/Users/yason/Documents/trae_projects/openwork/node_modules/.pnpm/ws@8.21.1/node_modules/ws");
const http = require("http");

http.get({ hostname: "127.0.0.1", port: 9823, path: "/json" }, (res) => {
  let data = "";
  res.on("data", (c) => (data += c));
  res.on("end", () => {
    const targets = JSON.parse(data);
    const page = targets.find((t) => t.type === "page");
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    socket.on("open", () => {
      socket.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
      // Find any diagnostics/runtime state on window or in the app
      setTimeout(() => {
        socket.send(JSON.stringify({
          id: 2, method: "Runtime.evaluate",
          params: { expression: `JSON.stringify({
            hasElectronBridge: !!window.__OPENWORK_ELECTRON__,
            hasServerHandle: !!(window.__OPENWORK_ELECTRON__ && window.__OPENWORK_ELECTRON__.system),
            keys: Object.keys(window).filter(k=>/openwork|server|electron|runtime/i.test(k))
          })`, returnByValue: true },
        }));
      }, 400);
    });
    socket.on("message", (m) => {
      const x = JSON.parse(m);
      if (x.id === 2) {
        console.log("WINDOW_PROBE:", x.result?.result?.value);
        socket.close(); process.exit(0);
      }
    });
  });
});