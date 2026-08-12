// Probe session route + enumerate visible UI elements.
const CDP_HTTP = "http://127.0.0.1:9223/json/list";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const list = await (await fetch(CDP_HTTP)).json();
  const target = list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
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
    }
  };
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = (e) => j(e); });
  await send("Runtime.enable");

  // Inject Chinese language preference (and completed onboarding) into localStorage
  // so the sidebar/UI labels render in zh, not the default en.
  await send("Runtime.evaluate", {
    expression: `(() => {
      try {
        localStorage.setItem("openwork.preferences", JSON.stringify({ hasCompletedOnboarding: true, language: "zh" }));
        localStorage.setItem("openwork.language", "zh");
      } catch (e) {}
      return true;
    })()`,
    returnByValue: true,
  });

  // Reload so the app picks up the injected language preference.
  await send("Page.reload", { ignoreCache: true });
  await wait(1500);

  // Wait for the page to be ready
  for (let i = 0; i < 15; i++) {
    const r = await send("Runtime.evaluate", { expression: "document.body ? document.body.innerText.length : 0", returnByValue: true });
    if (r.result?.value > 50) break;
    await wait(500);
  }

  const probe = await send("Runtime.evaluate", {
    expression: `(() => {
      const out = { url: location.href };
      const sideBtns = [...document.querySelectorAll('aside button, aside a, nav button, nav a')].map((b) => b.textContent.trim().replace(/\\s+/g, ' ')).filter(Boolean).slice(0, 50);
      out.sideBtns = sideBtns;
      out.headings = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.textContent.trim()).slice(0, 20);
      out.composerPresent = !!document.querySelector('textarea, [contenteditable]');
      out.composerPh = document.querySelector('textarea')?.placeholder ?? null;
      out.allButtons = [...document.querySelectorAll('button')].map((b) => b.textContent.trim().slice(0, 30)).filter(Boolean).slice(0, 50);
      return JSON.stringify(out);
    })()`,
    returnByValue: true,
  });
  if (probe.exceptionDetails) console.log("EXC:", probe.exceptionDetails.exception?.description);
  console.log("PROBE:", probe.result?.value);
  ws.close();
  process.exit(0);
}
main().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
