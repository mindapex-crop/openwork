// Find sidebar selectors + look for models/voice buttons.
const CDP_HTTP = "http://127.0.0.1:9223/json/list";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  const list = await (await fetch(CDP_HTTP)).json();
  const target = list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise((res, rej) => { const i = ++id; const t = setTimeout(() => { pending.delete(i); rej(new Error("timeout")); }, 10000); pending.set(i, { res: (v) => { clearTimeout(t); res(v); }, rej: (e) => { clearTimeout(t); rej(e); } }); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = (e) => j(e); });
  await send("Runtime.enable");
  await wait(2500);
  const r = await send("Runtime.evaluate", {
    expression: `(() => {
      // Find sidebar containers
      const sels = ['aside', 'nav', '[data-sidebar]', '[class*="sidebar"]', '[class*="Sidebar"]', '[class*="side-bar"]'];
      const found = sels.map((s) => ({ sel: s, count: document.querySelectorAll(s).length, sample: [...document.querySelectorAll(s)].slice(0, 2).map((e) => e.outerHTML.slice(0, 200)) }));
      // Search buttons for model/agent/voice keywords
      const allText = document.body.innerText;
      const hasModels = /\\b(All models|Models|所有模型|选择模型)\\b/i.test(allText);
      const hasVoice = /\\b(Voice|Mic|语音|麦克风)\\b/i.test(allText);
      const hasAgent = /\\b(Agent|Default agent)\\b/i.test(allText);
      // Find Sidebar trigger button area
      const allBtns = [...document.querySelectorAll('button')].slice(0, 80).map((b) => ({ text: b.textContent.trim().slice(0, 40), parent: b.parentElement?.tagName + (b.parentElement?.className?.toString().slice(0, 30) ?? '') }));
      return JSON.stringify({ found, hasModels, hasVoice, hasAgent, allBtns });
    })()`,
    returnByValue: true,
  });
  console.log("R:", r.result?.value);
  ws.close(); process.exit(0);
}
main().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
