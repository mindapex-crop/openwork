// Click the sidebar Projects button, capture network + errors, then inspect page.
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
  const htmlResponses = [];
  const exceptions = [];
  const logs = [];
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
      return;
    }
    const m = msg.method;
    if (m === "Network.responseReceived") {
      const { response, type } = msg.params;
      const ct = response?.headers?.["content-type"] || response?.mimeType || "";
      if ((type === "XHR" || type === "Fetch")) {
        if (/text\/html/i.test(ct) && !response?.url?.includes("vite")) {
          htmlResponses.push({ url: response.url, status: response.status, ct: ct.slice(0, 60) });
        }
        if (response?.status >= 400) {
          htmlResponses.push({ url: response.url, status: response.status, type, ct: ct.slice(0, 60), note: "status" });
        }
      }
    }
    if (m === "Runtime.exceptionThrown") {
      const d = msg.params?.exceptionDetails;
      const txt = d?.exception?.description || d?.text || "";
      exceptions.push(txt.slice(0, 500));
    }
    if (m === "Log.entryAdded") {
      const t = msg.params?.entry?.text || "";
      logs.push(t.slice(0, 300));
    }
    if (m === "Runtime.consoleAPICalled") {
      const args = (msg.params?.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      logs.push(args.slice(0, 300));
    }
  });

  // Wait for enable, then click the Projects sidebar button.
  setTimeout(() => {
    send("Runtime.evaluate", {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll("button, [role=button], a"));
        const targets = buttons.filter((b) => (b.textContent || "").trim() === "Projects" || (b.getAttribute("aria-label") || "").includes("Projects"));
        if (targets.length === 0) return "NO_PROJECTS_BUTTON";
        const b = targets[0];
        b.click();
        return "CLICKED " + b.tagName + " " + (b.getAttribute("aria-label") || "");
      })()`,
      returnByValue: true,
    });
  }, 1500);

  setTimeout(() => {
    send("Runtime.evaluate", {
      expression: `JSON.stringify({ url: location.href, body: document.body.innerText.slice(0, 500) })`,
      returnByValue: true,
    });
  }, 4000);

  setTimeout(() => {
    console.log("=== HTML/4xx responses ===");
    console.log(JSON.stringify(htmlResponses, null, 2));
    console.log("=== exceptions ===");
    console.log(JSON.stringify(exceptions, null, 2));
    console.log("=== logs ===");
    console.log(JSON.stringify(logs.slice(0, 30), null, 2));
    try {
      ws.close();
    } catch {}
    process.exit(0);
  }, 7000);
})().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(1);
});
