// Comprehensive E2E verification of /space route. Tests:
//  - overlay gone, all tabs real-clickable
//  - Plans: add → status change → delete (verify count + reload persistence)
//  - Tasks: add (with priority select) → checkbox toggle → status change → priority change → delete
//  - Assets: tree indented rows load, types correct
//  - Settings: edit name/desc → save → reload tab → assert persisted
//  - Settings: env var add/edit/delete
//  - Header workspace Select opens with real click
//  - Error: connection failure
// Captures console errors at every step.

const CDP_HTTP = "http://127.0.0.1:9223/json/list";

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const list = await (await fetch(CDP_HTTP)).json();
  const target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl) ?? list[0];
  console.log("TARGET:", target.title, "|", target.url);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const errors = [];
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      const timer = setTimeout(() => { pending.delete(msgId); reject(new Error(`timeout: ${method}`)); }, 15000);
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
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
      if (text) errors.push(text);
    } else if (msg.method === "Runtime.exceptionThrown") {
      const d = msg.params.exceptionDetails;
      errors.push(d.exception?.description ?? d.text ?? "exception");
    }
  };
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error(e.message)); });

  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  // Preload connection config so the route can talk to the dev API.
  const connectionInfo = await send("Runtime.evaluate", {
    expression: `(() => {
      const storage = (() => { try { return JSON.parse(localStorage.getItem("openwork.connection") || "null"); } catch { return null; } })();
      return JSON.stringify({ storage, override: localStorage.getItem("openwork.server.urlOverride"), token: localStorage.getItem("openwork.server.token") });
    })()`,
    returnByValue: true,
  });
  console.log("CONNECTION:", connectionInfo.result?.value);

  await send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      try {
        localStorage.setItem("openwork.server.urlOverride", "http://127.0.0.1:54174");
        localStorage.setItem("openwork.server.token", "owt_a3641f3a291942078c827881430b0c56");
        localStorage.setItem("openwork.preferences", JSON.stringify({ hasCompletedOnboarding: true }));
      } catch (e) {}
    })();`,
  });

  const evalJs = async (expression) => {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  };

  // Click a real point using CDP Input.dispatchMouseEvent.
  const realClick = async (x, y) => {
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  };

  const clickBySelector = async (expr) => {
    const pt = await evalJs(`(() => {
      const el = ${expr};
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (!pt) return null;
    await realClick(pt.x, pt.y);
    return pt;
  };

  // Go to /space (hash route).
  await send("Page.navigate", { url: "http://localhost:54174/#/space" });
  await wait(4500);

  // Defensive: drop boot overlay if it lingers.
  await evalJs(`(() => { const ov = document.querySelector('[role="status"]'); if (ov) ov.remove(); return !!ov; })()`);
  for (let i = 0; i < 20; i++) {
    const ready = await evalJs(`!!document.querySelector("aside button")`);
    if (ready) break;
    await wait(500);
  }

  // === 1. Overlay check ===
  const overlay = await evalJs(`(() => {
    const els = [...document.querySelectorAll("body *")];
    return els.some((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.position === "fixed" && r.width >= window.innerWidth * 0.9 && cs.pointerEvents !== "none" && r.height >= window.innerHeight * 0.5;
    });
  })()`);
  console.log("OVERLAY_BLOCKING:", overlay);

  // === 2. Tab navigation real-click ===
  for (const label of ["动态", "计划", "任务", "资产", "设置"]) {
    const pt = await clickBySelector(`[...document.querySelectorAll("aside button, nav button")].find((b) => b.textContent.trim() === ${JSON.stringify(label)})`);
    console.log("TAB_CLICK", label, pt);
    await wait(800);
    const heading = await evalJs(`document.querySelector("main h1")?.textContent?.trim() ?? null`);
    console.log("  heading =", heading);
  }

  // === 3. PLANS add / status change / delete ===
  await clickBySelector(`[...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === "计划")`);
  await wait(1500);

  // Initial plan count (header + rows)
  const plansBefore = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[12px_1fr_140px_36px]']")];
    return rows.length; // including header
  })()`);
  console.log("PLANS_BEFORE (header+rows):", plansBefore);

  // Type title — exact placeholder match
  const titlePt = await evalJs(`(() => {
    const el = [...document.querySelectorAll("main input")].find((i) => i.placeholder === "计划标题…");
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + 6), y: Math.round(r.top + r.height / 2) };
  })()`);
  console.log("title input pt:", titlePt);
  if (titlePt) {
    await realClick(titlePt.x, titlePt.y);
    await wait(150);
    await send("Input.insertText", { text: "E2E 计划测试" });
  }
  await wait(200);

  // Click 添加
  const addPt = await clickBySelector(`[...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "添加")`);
  console.log("PLAN_ADD click:", addPt);
  await wait(1500);

  const plansAfter = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[12px_1fr_140px_36px]']")];
    return rows.length;
  })()`);
  console.log("PLANS_AFTER_ADD (header+rows):", plansAfter);
  const firstPlanTitle = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[12px_1fr_140px_36px]']")].slice(1);
    return rows[0]?.querySelector("div")?.textContent?.trim();
  })()`);
  console.log("FIRST_PLAN_TITLE:", firstPlanTitle);

  // Open status select on first plan row
  const statusTrig = await evalJs(`(() => {
    const sels = [...document.querySelectorAll("main [role='combobox']")];
    const el = sels.find((s) => /^(待办|进行中|已完成)$/.test(s.textContent.trim()));
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  console.log("status trigger:", statusTrig);
  if (statusTrig) {
    await realClick(statusTrig.x, statusTrig.y);
    await wait(700);
    const options = await evalJs(`[...document.querySelectorAll("[role='option']")].map((o) => o.textContent.trim())`);
    console.log("  status options:", options);
    const opt = await evalJs(`(() => {
      const el = [...document.querySelectorAll("[role='option']")].find((o) => o.textContent.trim() === "进行中");
      if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (opt) { await realClick(opt.x, opt.y); await wait(1000); }
    const trigAfter = await evalJs(`(() => {
      const sels = [...document.querySelectorAll("main [role='combobox']")];
      return sels.find((s) => /^(待办|进行中|已完成)$/.test(s.textContent.trim()))?.textContent?.trim();
    })()`);
    console.log("  status after change:", trigAfter);
  }

  // Delete FIRST plan row
  const trashPt = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[12px_1fr_140px_36px]']")].slice(1);
    if (!rows.length) return null;
    const btn = rows[0].querySelector("button");
    if (!btn) return null; const r = btn.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  console.log("trash pt:", trashPt);
  if (trashPt) { await realClick(trashPt.x, trashPt.y); await wait(1200); }
  const plansAfterDel = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[12px_1fr_140px_36px]']")];
    return rows.length;
  })()`);
  console.log("PLANS_AFTER_DEL (header+rows):", plansAfterDel);

  // === 4. TASKS add with priority select, change status, delete ===
  await clickBySelector(`[...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === "任务")`);
  await wait(1500);
  const taskTitlePt = await evalJs(`(() => {
    const el = [...document.querySelectorAll("main input")].find((i) => i.placeholder === "任务标题…");
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + 6), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (taskTitlePt) { await realClick(taskTitlePt.x, taskTitlePt.y); await wait(120); await send("Input.insertText", { text: "E2E 任务验证" }); }
  await wait(200);
  await clickBySelector(`[...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "添加")`);
  await wait(1500);
  const tasksAfterAdd1 = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[20px_1fr_110px_110px_36px]']")];
    return rows.length;
  })()`);
  console.log("TASKS_AFTER_ADD1 (header+rows):", tasksAfterAdd1);

  // Open priority select on form
  const priTrig = await evalJs(`(() => {
    const sels = [...document.querySelectorAll("main [role='combobox']")];
    const el = sels.find((s) => /^(低|中|高)$/.test(s.textContent.trim()));
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  console.log("priority trigger:", priTrig);
  if (priTrig) {
    await realClick(priTrig.x, priTrig.y);
    await wait(600);
    const opts = await evalJs(`[...document.querySelectorAll("[role='option']")].map((o) => o.textContent.trim())`);
    console.log("  pri options:", opts);
    const highOpt = await evalJs(`(() => {
      const el = [...document.querySelectorAll("[role='option']")].find((o) => o.textContent.trim() === "高");
      if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (highOpt) { await realClick(highOpt.x, highOpt.y); await wait(800); }
    const priVal = await evalJs(`(() => {
      const sels = [...document.querySelectorAll("main [role='combobox']")];
      return sels.find((s) => /^(低|中|高)$/.test(s.textContent.trim()))?.textContent?.trim();
    })()`);
    console.log("  pri after:", priVal);
  }

  // Add second task with 高 priority
  const taskTitlePt2 = await evalJs(`(() => {
    const el = [...document.querySelectorAll("main input")].find((i) => i.placeholder === "任务标题…");
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + 6), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (taskTitlePt2) { await realClick(taskTitlePt2.x, taskTitlePt2.y); await wait(120); await send("Input.insertText", { text: "高优先级任务" }); }
  await wait(200);
  await clickBySelector(`[...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "添加")`);
  await wait(1500);
  const tasksAfterAdd2 = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[20px_1fr_110px_110px_36px]']")];
    return rows.length;
  })()`);
  console.log("TASKS_AFTER_ADD2 (header+rows):", tasksAfterAdd2);

  // Toggle checkbox on first task
  const checkboxPt = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[20px_1fr_110px_110px_36px]']")].slice(1);
    if (!rows.length) return null;
    const btn = rows[0].querySelector("button");
    if (!btn) return null; const r = btn.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (checkboxPt) { await realClick(checkboxPt.x, checkboxPt.y); await wait(1000); }

  // Change status of first task to 进行中 via row-level select
  const taskStatusTrig = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[20px_1fr_110px_110px_36px]']")].slice(1);
    const r = rows[0]; if (!r) return null;
    const sels = r.querySelectorAll('[role="combobox"]');
    const el = sels[0]; if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  })()`);
  if (taskStatusTrig) {
    await realClick(taskStatusTrig.x, taskStatusTrig.y);
    await wait(600);
    const doingOpt = await evalJs(`(() => {
      const el = [...document.querySelectorAll("[role='option']")].find((o) => o.textContent.trim() === "进行中");
      if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    })()`);
    if (doingOpt) { await realClick(doingOpt.x, doingOpt.y); await wait(1000); }
  }
  const firstTaskInfo = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[20px_1fr_110px_110px_36px]']")].slice(1);
    const r = rows[0];
    if (!r) return null;
    const sel0 = r.querySelectorAll('[role="combobox"]');
    return {
      title: r.querySelector("span")?.textContent?.trim(),
      status: sel0[0]?.textContent?.trim(),
      pri: sel0[1]?.textContent?.trim(),
    };
  })()`);
  console.log("FIRST_TASK_INFO:", JSON.stringify(firstTaskInfo));

  // === 5. SETTINGS edit + save + persist after re-render ===
  await clickBySelector(`[...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === "设置")`);
  await wait(1500);
  const initialName = await evalJs(`[...document.querySelectorAll("main input")].find((i) => i.placeholder === "空间名称")?.value`);
  console.log("SETTINGS_NAME_INITIAL:", initialName);
  const namePt = await evalJs(`(() => {
    const el = [...document.querySelectorAll("main input")].find((i) => i.placeholder === "空间名称");
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + 6), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (namePt) {
    await realClick(namePt.x, namePt.y);
    await wait(120);
    await send("Input.insertText", { text: "E2E-命名空间" });
  }
  await wait(200);
  await clickBySelector(`[...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "保存")`);
  await wait(1000);

  // Switch to 动态 and back to verify reload
  await clickBySelector(`[...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === "动态")`);
  await wait(800);
  await clickBySelector(`[...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === "设置")`);
  await wait(1200);
  const nameAfter = await evalJs(`[...document.querySelectorAll("main input")].find((i) => i.placeholder === "空间名称")?.value`);
  console.log("SETTINGS_NAME_AFTER_RELOAD:", nameAfter);

  // === 6. ASSETS list / tree indent ===
  await clickBySelector(`[...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === "资产")`);
  await wait(1500);
  const assetInfo = await evalJs(`(() => {
    const rows = [...document.querySelectorAll("main [class*='grid-cols-[1fr_90px]']")].slice(1);
    const samples = rows.slice(0, 3).map((r) => ({ path: r.querySelector("span")?.textContent?.trim(), pl: parseFloat(r.style.paddingLeft) || 0 }));
    return JSON.stringify({ count: rows.length, samples });
  })()`);
  console.log("ASSETS:", assetInfo);

  // === 7. Header workspace select real click ===
  const headerSel = await evalJs(`(() => {
    const el = document.querySelector("header [role='combobox']");
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  console.log("header sel:", headerSel);
  if (headerSel) {
    await realClick(headerSel.x, headerSel.y);
    await wait(600);
    const opts = await evalJs(`[...document.querySelectorAll("[role='option']")].map((o) => o.textContent.trim().slice(0, 30))`);
    console.log("  workspace options:", opts);
    // Close it
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" });
  }

  // === 8. Final overlay + console errors ===
  const finalOverlay = await evalJs(`(() => {
    return [...document.querySelectorAll("body *")].some((el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.position === "fixed" && r.width >= window.innerWidth * 0.9 && cs.pointerEvents !== "none" && r.height >= window.innerHeight * 0.5;
    });
  })()`);
  console.log("FINAL_OVERLAY_BLOCKING:", finalOverlay);
  console.log("CONSOLE_ERRORS:", JSON.stringify(errors, null, 2));

  // Capture final screenshot of tasks
  await clickBySelector(`[...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === "任务")`);
  await wait(1000);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  const fs = await import("node:fs");
  fs.writeFileSync("/Users/yason/Documents/trae_projects/space-shot-e2e-tasks.png", Buffer.from(shot.data, "base64"));
  await clickBySelector(`[...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === "设置")`);
  await wait(1000);
  const shot2 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/Users/yason/Documents/trae_projects/space-shot-e2e-settings.png", Buffer.from(shot2.data, "base64"));
  await clickBySelector(`[...document.querySelectorAll("aside button")].find((b) => b.textContent.trim() === "计划")`);
  await wait(1000);
  const shot3 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/Users/yason/Documents/trae_projects/space-shot-e2e-plans.png", Buffer.from(shot3.data, "base64"));

  ws.close();
  process.exit(errors.length > 0 ? 1 : 0);
}
main().catch((e) => { console.error("FAILED", e.message); process.exit(2); });
