// Probe the live Electron renderer: URL, body text, and the exact "Unexpected token" error source.
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

(async () => {
  const target = await getTarget();
  if (!target) throw new Error("no page target");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const exceptions = [];
  const evals = [];
  const send = (method, params = {}) => {
    const msgId = ++id;
    pending.set(msgId, { method });
    ws.send(JSON.stringify({ id: msgId, method, params }));
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
      pending.delete(msg.id);
      if (msg.id === 5 && msg.result && "result" in msg.result) {
        evals.push(msg.result.result.value ?? msg.result.result.description ?? "(undefined)");
      }
      return;
    }
    const m = msg.method;
    if (m === "Runtime.exceptionThrown") {
      const d = msg.params?.exceptionDetails;
      const txt = d?.exception?.description || d?.text || "";
      exceptions.push(txt.slice(0, 800));
    }
    if (m === "Network.responseReceived") {
      const { response, type } = msg.params;
      const ct = response?.headers?.["content-type"] || response?.mimeType || "";
      if ((type === "XHR" || type === "Fetch") && /text\/html/i.test(ct)) {
        exceptions.push(`HTML-RESP ${response.status} ${response.url.slice(0, 160)}`);
      }
    }
    if (m === "Runtime.consoleAPICalled" && msg.params?.type === "error") {
      const txt = (msg.params?.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      if (txt.includes("Unexpected token") || txt.includes("is not valid JSON")) {
        exceptions.push(`CONSOLE-ERR ${txt.slice(0, 500)}`);
      }
    }
  });

  setTimeout(() => {
    send("Runtime.evaluate", {
      expression: `JSON.stringify({
        url: location.href,
        body: document.body.innerText.slice(0, 1500),
        hasProjectsBtn: !!Array.from(document.querySelectorAll("button,a,[role=button]")).find(b => (b.textContent||"").trim()==="Projects")
      })`,
      returnByValue: true,
    });
  }, 1500);

  setTimeout(() => {
    console.log("=== page state ===");
    console.log(evals[0] ?? "(no eval result)");
    console.log("=== JSON-parse errors / HTML responses ===");
    console.log(JSON.stringify(exceptions, null, 2));
    try {
      ws.close();
    } catch {}
    process.exit(0);
  }, 5000);
})().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(1);
});
