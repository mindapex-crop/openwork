// Probe /space DOM structure precisely (used to fix e2e selectors).
const CDP_HTTP = "http://127.0.0.1:9223/json/list";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const list = await (await fetch(CDP_HTTP)).json();
  const target = list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise((res, rej) => {
    const i = ++id;
    const t = setTimeout(() => { pending.delete(i); rej(new Error("timeout")); }, 10000);
    pending.set(i, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } });
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = (e) => j(e); });
  await send("Runtime.enable");
  const evalJs = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;

  // Navigate to space
  await send("Page.navigate", { url: "http://localhost:54174/#/space" });
  await wait(3500);
  // Click 计划
  await evalJs(`(() => {
    const b = [...document.querySelectorAll('aside button')].find(x => x.textContent.trim() === '计划');
    if (b) b.click();
    return !!b;
  })()`);
  await wait(1500);
  const probe = await evalJs(`(() => {
    const main = document.querySelector('main');
    if (!main) return 'NO_MAIN';
    const inputs = [...main.querySelectorAll('input')].map((i) => ({ ph: i.placeholder, name: i.name, type: i.type, val: i.value }));
    // All unique grid container classnames
    const grid = [...main.querySelectorAll('div[class*="grid-cols-"]')].map((d) => d.className.match(/grid-cols-\[[^\]]+\]/)?.[0] ?? d.className.slice(0,80)).slice(0, 8);
    // Find header row by content: includes "状态"
    const header = [...main.querySelectorAll('div')].find((d) => {
      const t = d.textContent.trim();
      return d.children.length >= 2 && t === '计划状态' || t === '任务状态优先级' || t === '文件大小' || t === '会话更新时间';
    });
    // Find "添加" button
    const addBtn = [...main.querySelectorAll('button')].find((b) => b.textContent.trim() === '添加');
    // Find plan rows (after header)
    const allRows = [...main.querySelectorAll('main div[class*="grid-cols-["]')];
    return JSON.stringify({ inputs, grid, headerText: header?.textContent?.trim(), addBtnPresent: !!addBtn, allRows: allRows.length, allRowsCls: allRows.map((r) => r.className.match(/grid-cols-\[[^\]]+\]/)?.[0]) });
  })()`);
  console.log("PROBE:", probe);
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
