// Full zh-locale E2E verification across all main routes.
const CDP_HTTP = "http://127.0.0.1:9223/json/list";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const list = await (await fetch(CDP_HTTP)).json();
  const target = list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const errors = [];
  const send = (m, p = {}) => new Promise((res, rej) => {
    const i = ++id; const t = setTimeout(() => { pending.delete(i); rej(new Error("timeout")); }, 12000);
    pending.set(i, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errors.push((m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" "));
    } else if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      errors.push(d.exception?.description ?? d.text ?? "exception");
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = (e) => j(e); });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      try {
        localStorage.setItem("openwork.server.urlOverride", "http://127.0.0.1:54174");
        localStorage.setItem("openwork.server.token", "owt_a3641f3a291942078c827881430b0c56");
        localStorage.setItem("openwork.preferences", JSON.stringify({ hasCompletedOnboarding: true, language: "zh" }));
        localStorage.setItem("openwork.language", "zh");
      } catch (e) {}
    })();`,
  });

  const evalJs = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
  const realClick = async (x, y) => {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  };
  const clickBy = async (expr) => {
    const pt = await evalJs(`(() => { const el = ${expr}; if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0) return null; return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`);
    if (!pt) return null;
    await realClick(pt.x, pt.y);
    return pt;
  };

  const summary = {};

  // === ROUTE 1: Session page (default landing) ===
  await send("Page.navigate", { url: "http://localhost:54174/#/workspace/ws_591461afe278/session" });
  await wait(5000);
  summary.session = await evalJs(`(() => {
    const out = {};
    out.url = location.href;
    out.sidebarItems = [...document.querySelectorAll('[data-sidebar="menu-button"]')].map((b) => b.textContent.trim().replace(/\\s+/g, ' ')).filter(Boolean);
    out.headings = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.textContent.trim()).slice(0, 10);
    out.composer = !!document.querySelector('textarea, [contenteditable]');
    out.composerPh = document.querySelector('textarea')?.placeholder ?? null;
    out.modelBtns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /models|模型|agent/i.test(t)).slice(0, 8);
    out.voiceBtns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /voice|语音|mic|microphone|麦克风/i.test(t)).slice(0, 8);
    out.skillBtns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /skill|技能|mcp/i.test(t)).slice(0, 8);
    out.recommendedTasks = [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => t.length > 10 && t.length < 200 && (t.includes(' ') || /[一-鿿]/.test(t))).slice(0, 8);
    return JSON.stringify(out);
  })()`);
  console.log("SESSION:", summary.session);

  // === ROUTE 2: /space ===
  await send("Page.navigate", { url: "http://localhost:54174/#/space" });
  await wait(4000);
  await evalJs(`(() => { const ov = document.querySelector('[role="status"]'); if (ov) ov.remove(); })()`);
  const tabs = ["动态", "计划", "任务", "资产", "设置"];
  summary.spaceTabs = [];
  for (const label of tabs) {
    const pt = await clickBy(`[...document.querySelectorAll('[data-sidebar="menu-button"], aside button, nav button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`);
    await wait(1200);
    const heading = await evalJs(`document.querySelector("main h1")?.textContent?.trim() ?? null`);
    summary.spaceTabs.push({ label, clicked: !!pt, heading });
  }
  console.log("SPACE_TABS:", summary.spaceTabs);

  // === ROUTE 3: /admin ===
  await send("Page.navigate", { url: "http://localhost:54174/#/admin" });
  await wait(4000);
  await evalJs(`(() => { const ov = document.querySelector('[role="status"]'); if (ov) ov.remove(); })()`);
  summary.admin = await evalJs(`(() => {
    const out = {};
    out.heading = document.querySelector("main h1, h2, h3")?.textContent?.trim();
    out.btns = [...document.querySelectorAll("main button")].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 20);
    out.tabs = [...document.querySelectorAll("[role='tab'], [data-state]")].map((b) => b.textContent.trim()).filter(Boolean).slice(0, 20);
    out.body = (document.querySelector("main")?.innerText ?? "").slice(0, 400);
    return JSON.stringify(out);
  })()`);
  console.log("ADMIN:", summary.admin);

  // === ROUTE 4: /settings ===
  await send("Page.navigate", { url: "http://localhost:54174/#/settings" });
  await wait(4000);
  await evalJs(`(() => { const ov = document.querySelector('[role="status"]'); if (ov) ov.remove(); })()`);
  summary.settings = await evalJs(`(() => {
    const out = {};
    out.heading = document.querySelector("main h1, h2, h3")?.textContent?.trim();
    out.body = (document.querySelector("main")?.innerText ?? "").slice(0, 400);
    return JSON.stringify(out);
  })()`);
  console.log("SETTINGS:", summary.settings);

  console.log("CONSOLE_ERRORS:", JSON.stringify(errors, null, 2));
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
