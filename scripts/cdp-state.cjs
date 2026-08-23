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
        socket.send(JSON.stringify({
          id: 2, method: "Runtime.evaluate", returnByValue: true,
          params: { expression: `(async () => {
            const local = {};
            try { for (let i=0;i<localStorage.length;i++){const k=localStorage.key(i); if(/openwork|server|baseurl|port|workspace/i.test(k)) local[k]=localStorage.getItem(k);} } catch(e){ local.__err=String(e); }
            let info=null, err=null;
            try {
              const d = window.__OPENWORK_ELECTRON__;
              // try known getters
              info = await (d.system && d.system.openworkServerInfo ? d.system.openworkServerInfo() : null);
            } catch(e){ err=String(e); }
            return JSON.stringify({ local, info, err });
          })()`, awaitPromise: true },
        }));
      }, 400);
    });
    socket.on("message", (m) => {
      const x = JSON.parse(m);
      if (x.id === 2) { console.log("RESULT:", x.result?.result?.value); socket.close(); process.exit(0); }
    });
  });
});