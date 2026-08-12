// CDP verification v5: real mouse clicks on each /space tab + table layout + screenshots + console errors.
const CDP_HTTP = "http://127.0.0.1:9223/json/list";
const PAGE_URL = "http://localhost:5173/space";

const tabs = [
  { label: "动态", file: "activity" },
  { label: "计划", file: "plans" },
  { label: "任务", file: "tasks" },
  { label: "资产", file: "assets" },
  { label: "设置", file: "settings" },
];

async function main() {
  const list = await (await fetch(CDP_HTTP)).json();
  const target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ?? list[0];
  console.log("TARGET:", target.title, "|", (target.url || "").slice(0, 80));

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      const timer = setTimeout(() => { pending.delete(msgId); reject(new Error(`timeout: ${method}`)); }, 15000);
      pending.set(msgId, {
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); },
      });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      errors.push(text);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception?.description ?? d.text ?? "exception");
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = (e) => reject(new Error("ws error: " + e.message));
  });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      try {
        localStorage.setItem("openwork.server.urlOverride", "http://127.0.0.1:54174");
        localStorage.setItem("openwork.server.token", "owt_a3641f3a291942078c827881430b0c56");
        localStorage.setItem("openwork.preferences", JSON.stringify({ hasCompletedOnboarding: true }));
      } catch (e) {}
    })();`,
  });

  await send("Page.navigate", { url: PAGE_URL });
  await new Promise((r) => setTimeout(r, 4000));

  const evalJs = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  };

  // Bypass any leftover boot overlay (defensive) then wait for <main>.
  await evalJs(`(() => { const ov = document.querySelector('[role="status"]'); if (ov) ov.remove(); return !!ov; })()`);
  for (let i = 0; i < 20; i++) {
    const ready = await evalJs(`!!document.querySelector("main")`);
    if (ready) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  // Real mouse click helper.
  const realClick = async (selectorExpr) => {
    const pt = await evalJs(`(() => {
      const el = ${selectorExpr};
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), text: el.textContent.trim().slice(0, 20) };
    })()`);
    if (!pt) return null;
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    return pt;
  };

  const fs = await import("node:fs");
  for (const tab of tabs) {
    const clicked = await realClick(
      `[...document.querySelectorAll("aside button, nav button")].find((b) => b.textContent.trim() === ${JSON.stringify(tab.label)})`,
    );
    console.log("REAL_CLICK", tab.label, "->", clicked ? `(${clicked.x},${clicked.y})` : "NOT_FOUND");
    await new Promise((r) => setTimeout(r, 1500));

    const dump = await evalJs(`(() => {
      const main = document.querySelector("main");
      if (!main) return "NO_MAIN";
      const text = main.innerText.replace(/\\s+/g, " ").trim();
      const tables = [...main.querySelectorAll("[class*='grid grid-cols'], [class*='grid-cols[']")].length;
      const headerCells = [...main.querySelectorAll("main [class*='text-xs font-medium']")].map((c) => c.textContent.trim()).filter(Boolean);
      const selects = [...main.querySelectorAll("[role='combobox']")].map((s) => s.textContent.trim());
      const rows = [...main.querySelectorAll("[class*='border-t border-dls-border']")].length;
      const overlayBlocking = [...document.querySelectorAll("body > *")].some((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.position === "fixed" && r.width >= window.innerWidth * 0.9 && cs.pointerEvents !== "none";
      });
      return JSON.stringify({ text: text.slice(0, 300), headerCells, selects, rows, overlayBlocking });
    })()`);
    console.log("TAB_DUMP", tab.file, ":", dump);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(`/Users/yason/Documents/trae_projects/space-shot-${tab.file}.png`, Buffer.from(shot.data, "base64"));
    console.log("SHOT saved:", tab.file);
  }

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors, null, 2));
  ws.close();
  process.exit(0);
}

main().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
