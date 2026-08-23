// Inspect current model selection + provider error in the running OpenWork UI via CDP.
const http = require("http");
const WebSocket = globalThis.WebSocket;

function getTarget() {
  return new Promise((resolve, reject) => {
    http
      .get("http://127.0.0.1:9823/json/list", (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            const list = JSON.parse(d);
            resolve(list.find((t) => t.type === "page") || null);
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function cdpEval(wsUrl, expression) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      try {
        ws.close();
      } catch {}
      fn(v);
    };
    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: { expression, returnByValue: true, awaitPromise: true },
        })
      );
    });
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id === 1) finish(resolve, msg);
    });
    ws.addEventListener("error", () => finish(reject, new Error("ws error")));
    setTimeout(() => finish(reject, new Error("timeout")), 8000);
  });
}

(async () => {
  const target = await getTarget();
  if (!target) throw new Error("no page target");
  console.log("URL:", target.url);
  // Read localStorage server/token + any zen/den inference prefs
  const expr = `(() => {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (/server|token|model|den|zen|inference|provider/i.test(k)) ls[k] = (v || "").slice(0, 200);
    }
    return { ls };
  })()`;
  const res = await cdpEval(target.webSocketDebuggerUrl, expr);
  console.log(JSON.stringify(res?.result?.result?.value ?? res, null, 2));
})().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(1);
});
