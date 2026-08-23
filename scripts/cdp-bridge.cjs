const WebSocket = require("/Users/yason/Documents/trae_projects/openwork/node_modules/.pnpm/ws@8.21.1/node_modules/ws");
const http = require("http");

http.get({ hostname: "127.0.0.1", port: 9823, path: "/json" }, (res) => {
  let data = "";
  res.on("data", (c) => (data += c));
  res.on("end", () => {
    const page = JSON.parse(data).find((t) => t.type === "page");
    const socket = new WebSocket(page.webSocketDebuggerUrl);
    socket.on("open", () => {
      socket.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
      setTimeout(() => {
        // Inspect the electron bridge keys to find the server info getter
        socket.send(JSON.stringify({
          id: 5, method: "Runtime.evaluate",
          params: { expression: `(async () => {
            const d = window.__OPENWORK_ELECTRON__;
            const out = { bridgeKeys: Object.keys(d||{}) };
            try {
              out.serverInfo = await d.invokeDesktop("openworkServerInfo");
            } catch(e){ out.serverInfoErr = String(e); }
            try {
              out.engineInfo = await d.invokeDesktop("engineInfo");
            } catch(e){ out.engineInfoErr = String(e); }
            return JSON.stringify(out);
          })()`, awaitPromise: true, returnByValue: true },
        }));
      }, 300);
    });
    socket.on("message", (m) => {
      const x = JSON.parse(m);
      if (x.id === 5) { console.log("INFO:", x.result?.result?.value); socket.close(); process.exit(0); }
    });
  });
});