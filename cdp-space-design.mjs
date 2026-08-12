// 全面检查 space 界面：布局结构、样式、溢出、空态
import { writeFileSync } from "node:fs";

const WS_URL = process.argv[2];
const nextId = [1];
const pending = new Map();
const ws = new WebSocket(WS_URL);
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = nextId[0]++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
};
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
await send("Runtime.enable");
await send("Page.enable");

const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

await evalJs(`location.hash = "#/space"; "ok"`);
await new Promise((r) => setTimeout(r, 4500));

// 截图（默认 tab = 动态）
const shot1 = await send("Page.captureScreenshot", { format: "png" });
if (shot1.data) writeFileSync("/Users/yason/Documents/trae_projects/openwork/space-shot-activity.png", Buffer.from(shot1.data, "base64"));

// 1. 整体布局概览
const layout = await evalJs(`(() => {
  const root = document.querySelector('#root, [data-slot="app-shell"], main, .app-shell');
  const out = { viewport: [innerWidth, innerHeight], bodyChildren: [...document.body.children].map(c => c.tagName + "." + (c.className || "").toString().slice(0, 40)) };
  // 找到 space 主容器
  const buttons = [...document.querySelectorAll("button")].map(b => b.innerText.trim()).filter(Boolean);
  return JSON.stringify({ ...out, buttons: buttons.slice(0, 30) }, null, 0);
})()`);
console.log("LAYOUT:", layout);

// 2. 检查左侧 tab 栏的样式细节
const tabsInfo = await evalJs(`(() => {
  const items = [...document.querySelectorAll("button")].filter(b => ["动态","计划","任务","资产","设置"].includes(b.innerText.trim()));
  return JSON.stringify(items.map(b => ({
    text: b.innerText.trim(),
    cls: b.className.toString().slice(0, 120),
    color: getComputedStyle(b).color,
    bg: getComputedStyle(b).backgroundColor,
    fontSize: getComputedStyle(b).fontSize,
    radius: getComputedStyle(b).borderRadius,
    pad: getComputedStyle(b).padding,
    active: b.getAttribute("data-active") || getComputedStyle(b).fontWeight,
  })));
})()`);
console.log("TABS:", tabsInfo);

// 3. 每个 tab 的内容区与溢出检查
const clickTab = async (label) => {
  await evalJs(`(() => {
    const b = [...document.querySelectorAll("button")].find(x => x.innerText.trim() === ${JSON.stringify(label)});
    if (b) b.click();
    return "ok";
  })()`);
  await new Promise((r) => setTimeout(r, 1800));
};

for (const tab of ["计划", "任务", "资产", "设置"]) {
  await clickTab(tab);
  const info = await evalJs(`(() => {
    const doc = document.documentElement;
    const overflow = doc.scrollWidth > doc.clientWidth + 2 || doc.scrollHeight > doc.clientHeight + 2;
    const body = document.body.innerText.slice(0, 450);
    const inputs = [...document.querySelectorAll("input")].map(i => ({ ph: i.placeholder, w: getComputedStyle(i).width, h: getComputedStyle(i).height }));
    const selects = [...document.querySelectorAll("[role=combobox], select")].map(s => s.innerText || s.value || "").filter(Boolean);
    return JSON.stringify({ overflow, body, inputs: inputs.slice(0, 6), selects: selects.slice(0, 5) });
  })()`);
  console.log(`\n=== TAB ${tab} ===`);
  console.log(info);
}

// 回到动态 tab 截全图
await clickTab("动态");
await new Promise((r) => setTimeout(r, 1500));
const shot2 = await send("Page.captureScreenshot", { format: "png" });
if (shot2.data) writeFileSync("/Users/yason/Documents/trae_projects/openwork/space-shot-final.png", Buffer.from(shot2.data, "base64"));
console.log("\nscreenshots: space-shot-activity.png, space-shot-final.png");

ws.close();
process.exit(0);
