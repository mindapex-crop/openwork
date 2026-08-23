const WebSocket = require("/Users/yason/Documents/trae_projects/openwork/node_modules/.pnpm/ws@8.21.1/node_modules/ws");
const http = require("http");

function send(port, method, params = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ id: Math.floor(Math.random() * 1e9), method, params });
    const req = http.request({ hostname: "127.0.0.1", port, path: "/json/protocol", method: "POST" }, () => {});
    req.on("error", reject);
    req.end();
  });
}

// Get the page target on CDP 9823
http.get({ hostname: "127.0.0.1", port: 9823, path: "/json" }, (res) => {
  let data = "";
  res.on("data", (c) => (data += c));
  res.on("end", () => {
    const targets = JSON.parse(data);
    const page = targets.find((t) => t.type === "page");
    console.log("PAGE_URL:", page && page.url);
    if (!page) return;
    const ws = page.webSocketDebuggerUrl;
    const socket = new WebSocket(ws);
    const outstanding = new Map();
    socket.on("open", () => {
      // Collect console API + exceptions
      socket.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
      socket.send(JSON.stringify({ id: 2, method: "Log.enable" }));
      socket.send(JSON.stringify({ id: 3, method: "Network.enable" }));
      setTimeout(() => {
        // Capture current + any queued state, and recent network error URLs
        socket.send(JSON.stringify({
          id: 4, method: "Runtime.evaluate",
          params: { expression: `JSON.stringify({
            url: location.href,
            path: location.pathname,
            hash: location.hash
          })`, returnByValue: true },
        }));
      }, 500);
      // After 6s of passive capture, dump anything seen.
      setTimeout(() => { socket.close(); process.exit(0); }, 7000);
    });
    const eventNames = new Set(["Runtime.consoleAPICalled", "Runtime.exceptionThrown", "Log.entryAdded",
      "Network.loadingFailed", "Network.responseReceived"]);
    let networkFails = 0;
    socket.on("message", (msg) => {
      const m = JSON.parse(msg);
      if (m.id === 4) {
        console.log("ROUTE_EVAL:", m.result?.result?.value);
        setTimeout(() => { socket.close(); process.exit(0); }, 1200);
        return;
      }
      if (m.method === "Runtime.consoleAPICalled") {
        const text = (m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
        if (/json|doctype|Unexpected token|parse/i.test(text)) console.log("CONSOLE:", text.slice(0, 500));
      }
      if (m.method === "Runtime.exceptionThrown") {
        const d = m.params.exceptionDetails;
        const txt = (d.exception?.description || d.text || "").slice(0, 600);
        if (/json|doctype|Unexpected token/i.test(txt)) console.log("EXCEPTION:", txt);
      }
      if (m.method === "Log.entryAdded" && /json|doctype|Unexpected token/i.test(m.params.entry?.text || "")) {
        console.log("LOG:", m.params.entry.text.slice(0, 500));
      }
      if (m.method === "Network.loadingFailed") {
        networkFails++;
        const e = m.params;
        const url = e.requestId;
        console.log("NET_FAIL:", e.type, e.errorText, e.requestId);
      }
      if (m.method === "Network.responseReceived") {
        const r = m.params.response;
        if (r.status >= 400 || (r.mimeType && r.mimeType.includes("text/html") && /opencode|openwork/i.test(r.url))) {
          console.log("HTTP:", r.status, r.mimeType, r.url.slice(0, 200));
        }
      }
      if (m.method === "Network.requestWillBeSent") {
        const r = m.params.request;
        if (r.url && (r.url.includes("session-groups") || /\.tsx|\.ts|@vite/i.test(r.url) === false && /api|json/i.test(r.url))) {
          // skip noise
        }
      }
      if (m.method === "Log.entryAdded" && m.params.entry?.level === "error") {
        console.log("LOG_ERR:", (m.params.entry.text || "").slice(0, 400));
      }
    });
  });
});