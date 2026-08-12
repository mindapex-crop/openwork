// Verify new WorkBuddy-style space table UI structure via DOM inspection.
const CDP_HTTP = "http://127.0.0.1:9223/json/list";
const PAGE_URL = "http://localhost:5173/space";

async function main() {
  const list = await (await fetch(CDP_HTTP)).json();
  const target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ?? list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      const timer = setTimeout(() => { pending.delete(msgId); reject(new Error(`timeout: ${method}`)); }, 12000);
      pending.set(msgId, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = (e) => reject(new Error(e.message)); });
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
  await new Promise((r) => setTimeout(r, 4500));

  const evalJs = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  };

  // Click each tab with REAL mouse events and inspect table container styles.
  const tabs = ["计划", "任务", "资产", "设置"];
  for (const label of tabs) {
    const pt = await evalJs(`(() => {
      const el = [...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === ${JSON.stringify(label)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (!pt) { console.log("NO TAB:", label); continue; }
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pt.x, y: pt.y, button: "left", clickCount: 1 });
    await new Promise((r) => setTimeout(r, 1200));

    const info = await evalJs(`(() => {
      const main = document.querySelector("main");
      const heading = main?.querySelector("h1");
      const header = main?.querySelector("[class*='text-xs font-medium']")?.parentElement;
      const table = main?.querySelector("[class*='overflow-hidden rounded-xl border']");
      const row = main?.querySelector("[class*='border-t border-dls-border']") ?? main?.querySelector("[class*='hover:bg-gray-2/40']");
      const g = (el) => el ? getComputedStyle(el) : null;
      const cs = g(table);
      const hc = g(header);
      const rc = g(row);
      return JSON.stringify({
        heading: heading?.textContent ?? null,
        tableBg: cs?.backgroundColor, tableRadius: cs?.borderRadius, tableBorder: cs?.borderColor,
        headerBg: hc?.backgroundColor, headerPadding: hc?.padding,
        gridTemplate: row ? getComputedStyle(row).display === "grid" ? getComputedStyle(row).gridTemplateColumns : "NOT_GRID" : null,
        rowCount: main?.querySelectorAll("[class*='border-t border-dls-border']").length ?? 0,
      });
    })()`);
    console.log(label, ":", info);
  }
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
