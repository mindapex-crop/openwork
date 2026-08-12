// CDP click-blocker diagnosis: real mouse events + elementFromPoint to find what covers the space page.
const CDP_HTTP = "http://127.0.0.1:9223/json/list";
const PAGE_URL = "http://localhost:5173/space";

async function main() {
  const list = await (await fetch(CDP_HTTP)).json();
  const target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ?? list[0];
  console.log("TARGET:", target.title, "|", (target.url || "").slice(0, 80));

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
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });

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
  await new Promise((r) => setTimeout(r, 5000));

  const evalJs = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  };

  // 1. Enumerate every full-window/fixed element + what's at each tab button's center.
  const diag = await evalJs(`(() => {
    const out = { fixed: [], tabs: [] };
    for (const el of document.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const isFullBlock = cs.position === "fixed" && r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.9;
      if (isFullBlock || el === document.body) {
        out.fixed.push({
          tag: el.tagName, cls: (el.className || "").toString().slice(0, 90),
          z: cs.zIndex, pe: cs.pointerEvents, role: el.getAttribute("role"),
          w: Math.round(r.width), h: Math.round(r.height),
          text: (el.textContent || "").trim().slice(0, 60),
        });
      }
    }
    // Tab buttons: center point, what element is on top there.
    const btns = [...document.querySelectorAll("aside button, nav button")];
    for (const b of btns) {
      const r = b.getBoundingClientRect();
      const cx = Math.round(r.left + r.width / 2), cy = Math.round(r.top + r.height / 2);
      const top = document.elementFromPoint(cx, cy);
      const topInfo = top ? {
        tag: top.tagName, cls: (top.className || "").toString().slice(0, 70),
        pe: getComputedStyle(top).pointerEvents, isSame: top === b,
      } : null;
      out.tabs.push({ label: b.textContent.trim().slice(0, 10), x: cx, y: cy, top: topInfo });
    }
    return JSON.stringify(out);
  })()`);
  console.log("DIAG:", diag);

  // 2. Real mouse click on the 任务 tab (2nd tab in aside), then confirm state change.
  const targetTab = await evalJs(`(() => {
    const b = [...document.querySelectorAll("aside button")].find((x) => x.textContent.trim() === "任务");
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (targetTab) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: targetTab.x, y: targetTab.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: targetTab.x, y: targetTab.y, button: "left", clickCount: 1 });
    await new Promise((r) => setTimeout(r, 1200));
    const after = await evalJs(`(() => {
      const main = document.querySelector("main");
      return JSON.stringify({ heading: main?.querySelector("h1,h2,h3")?.textContent ?? null, path: location.pathname });
    })()`);
    console.log("AFTER_REAL_CLICK_TASKS:", after);
  }

  // 3. Real click on the workspace Select in the header.
  const sel = await evalJs(`(() => {
    const s = document.querySelector("[role='combobox']");
    if (!s) return null;
    const r = s.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (sel) {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: sel.x, y: sel.y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: sel.x, y: sel.y, button: "left", clickCount: 1 });
    await new Promise((r) => setTimeout(r, 800));
    const popup = await evalJs(`(() => {
      const items = [...document.querySelectorAll("[role='option']")].map((o) => o.textContent.trim().slice(0, 30));
      return JSON.stringify({ open: items.length, items: items.slice(0, 5) });
    })()`);
    console.log("SELECT_AFTER_REAL_CLICK:", popup);
  }

  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
