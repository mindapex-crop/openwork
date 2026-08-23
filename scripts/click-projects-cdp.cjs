// Click Projects and capture network + errors + resulting route.
const http = require("http");
const WebSocket = globalThis.WebSocket;

function getTarget() {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:9823/json/list", (res) => {
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
    }).on("error", reject);
  });
}

(async () => {
  const target = await getTarget();
  if (!target) throw new Error("no page target");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const observations = [];
  const send = (method, params = {}) => {
    const msgId = ++id;
    pending.set(msgId, { method });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  };
  const evalJs = (expression, tag) => {
    const msgId = ++id;
    pending.set(msgId, { method: "Runtime.evaluate", tag });
    ws.send(JSON.stringify({ id: msgId, method: "Runtime.evaluate", params: { expression, returnByValue: true } }));
  };
  ws.addEventListener("open", () => {
    send("Runtime.enable");
    send("Network.enable");
    send("Log.enable");
    send("Page.enable");
  });
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(String(event.data));
    if (msg.id && pending.has(msg.id)) {
      const entry = pending.get(msg.id);
      pending.delete(msg.id);
      if (entry.tag && msg.result && "result" in msg.result) {
        observations.push(`${entry.tag}: ${msg.result.result.value ?? "(void)"}`);
      }
      return;
    }
    const m = msg.method;
    if (m === "Runtime.exceptionThrown") {
      const d = msg.params?.exceptionDetails;
      observations.push(`EXC: ${(d?.exception?.description || d?.text || "").slice(0, 500)}`);
    }
    if (m === "Network.responseReceived") {
      const { response, type } = msg.params;
      const ct = response?.headers?.["content-type"] || response?.mimeType || "";
      if ((type === "XHR" || type === "Fetch") && /text\/html/i.test(ct)) {
        observations.push(`HTML-RESP ${response.status} ${response.url}`);
      }
      if ((type === "XHR" || type === "Fetch") && response?.status >= 400) {
        observations.push(`HTTP-${response.status} ${response.url.slice(0, 160)}`);
      }
    }
    if (m === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
      const txt = (msg.params?.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      observations.push(`CONSOLE-ERR ${txt.slice(0, 400)}`);
    }
  });

  // Enable then click Projects tab
  setTimeout(() => evalJs(`(() => {
    const b = Array.from(document.querySelectorAll("button,a,[role=button]"))
      .find(b => (b.textContent||"").trim()==="Projects");
    if (!b) return "NO_BTN";
    b.click();
    return "clicked";
  })()`, "click"), 1000);

  setTimeout(() => evalJs(`JSON.stringify({url:location.href, hasTitle: document.body.innerText.includes('Projects'), body: document.body.innerText.slice(0,1200)})`, "after-click"), 3000);

  setTimeout(() => {
    console.log(observations.join("\n"));
    try { ws.close(); } catch {}
    process.exit(0);
  }, 5500);
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });