// Directly navigate to the hash route /projects and observe the result + any JSON parse error.
const http = require("http");
const WebSocket = globalThis.WebSocket;

function getTarget() {
  return new Promise((resolve, reject) => {
    http.get("http://127.0.0.1:9823/json/list", (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try { const list = JSON.parse(d); resolve(list.find((t) => t.type === "page") || null); }
        catch (e) { reject(e); }
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
  const obs = [];
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
        obs.push(`${entry.tag}: ${msg.result.result.value ?? "(void)"}`);
      }
      return;
    }
    const m = msg.method;
    if (m === "Runtime.exceptionThrown") {
      const d = msg.params?.exceptionDetails;
      const txt = (d?.exception?.description || d?.text || "").slice(0, 600);
      if (/JSON|fetch|Unexpected/i.test(txt)) obs.push(`EXC: ${txt}`);
    }
    if (m === "Network.responseReceived") {
      const { response, type } = msg.params;
      const ct = response?.headers?.["content-type"] || response?.mimeType || "";
      if ((type === "XHR" || type === "Fetch") && /text\/html/i.test(ct)) {
        obs.push(`HTML-RESP ${response.status} ${response.url}`);
      }
    }
    if (m === "Runtime.consoleAPICalled") {
      const txt = (msg.params?.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      if (/Unexpected token|is not valid JSON/.test(txt)) {
        obs.push(`CONSOLE: ${txt.slice(0, 500)}`);
      }
    }
  });

  setTimeout(() => evalJs(`location.hash = "#/projects"; "set"`, "set-hash"), 1000);
  setTimeout(() => evalJs(`JSON.stringify({url:location.href, bodySeg: document.body.innerText.includes('New project')})`, "after"), 2500);
  setTimeout(() => evalJs(`JSON.stringify(document.body.innerText.slice(0, 900))`, "body"), 4500);

  setTimeout(() => {
    console.log(obs.join("\n"));
    try { ws.close(); } catch {}
    process.exit(0);
  }, 7000);
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });