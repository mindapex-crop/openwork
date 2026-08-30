#!/usr/bin/env python3
"""
Extract text + download images from all 10 WorkBuddy doc pages.
Uses the <div class="vp-doc ..."> block as content source.
"""
import re, os, subprocess, html as htmlmod
from pathlib import Path
from html.parser import HTMLParser

BASE_DIR = Path("/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research")
HTML_DIR = BASE_DIR / "html"
IMG_DIR  = BASE_DIR / "img"
IMG_DIR.mkdir(parents=True, exist_ok=True)

BASE_URL = "https://www.codebuddy.cn"

PAGES = [
    ("task-bar",              "Task-Bar"),
    ("permission-modes",      "Permission-Modes"),
    ("setting",               "Setting"),
    ("memory",                "Memory"),
    ("assistant",             "Assistant"),
    ("project",               "Project"),
    ("right-sidebar",         "Right-Sidebar"),
    ("lightweight-publish",   "Lightweight-Publish"),
    ("cowriting",             "Cowriting"),
    ("mailbox",               "Mailbox"),
]


def extract_vp_doc_block(raw_html):
    """Extract the <div class="vp-doc ..."> ... </div> region using
    raw-text scan for image extraction."""
    m_open = re.search(r'<div\s[^>]*class="[^"]*vp-doc[^"]*"[^>]*>', raw_html)
    if not m_open:
        return raw_html
    open_end = m_open.end()
    depth = 1
    i = open_end
    close_open = len(raw_html)
    while i < len(raw_html) - 5 and depth > 0:
        if raw_html[i:i+6] == '</div>':
            depth -= 1
            if depth == 0:
                close_open = i
                break
            i += 6
        elif raw_html[i:i+4] == '<div':
            end_tag = raw_html.find('>', i)
            if end_tag == -1:
                break
            if raw_html[end_tag-1:end_tag] == '/':
                pass
            else:
                depth += 1
            i = end_tag + 1
        else:
            i += 1
    return raw_html[m_open.start(): close_open + 6]


def extract_main_block(raw_html):
    """Extract the <main class="main" ...> ... </main> region."""
    m = re.search(r'<main\b[^>]*class="[^"]*main[^"]*"[^>]*>(.*?)</main>', raw_html, re.DOTALL)
    if m:
        return m.group(1)
    # fallback: any <main ...> ... </main>
    m = re.search(r'<main\b[^>]*>(.*?)</main>', raw_html, re.DOTALL)
    if m:
        return m.group(1)
    return raw_html


class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self._skip_stack = []
        self._in_img = False

    def _is_skip(self, tag):
        return tag in ("script","style","svg","noscript")

    def _is_nav(self, tag, attrs):
        if tag not in ("nav","footer","header","aside"):
            return False
        cls = ""
        for k,v in attrs:
            if k == "class":
                cls = str(v)
        if "VPDocFooter" in cls or "VPNav" in cls or "VPNavBar" in cls:
            return True
        if tag == "aside":
            return True
        if tag == "footer":
            return True
        if tag == "header":
            return True
        if tag == "nav" and "VPDocFooter" not in cls and "VPDocAside" not in cls:
            return True
        return False

    def handle_starttag(self, tag, attrs):
        if self._is_skip(tag):
            self._skip_stack.append(tag)
            return
        if self._skip_stack:
            if tag == self._skip_stack[-1]:
                pass  # nested same-name, don't double-push
            return
        if self._is_nav(tag, attrs):
            self._skip_stack.append(tag)
            return
        if tag == "img":
            self._in_img = True
            # <img> 是 HTML 空元素，HTMLParser 不会发 handle_endtag，所以立即关闭
            self._in_img = False
        if tag in ("p","li","h1","h2","h3","h4","h5","h6","pre","figcaption","td","th","dt","dd","tr","blockquote","dl"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if self._skip_stack and tag == self._skip_stack[-1]:
            self._skip_stack.pop()
            return
        if self._skip_stack:
            return
        if tag == "img":
            self._in_img = False
        if tag in ("p","li","h1","h2","h3","h4","h5","h6","pre","tr","figcaption","td","th","dt","dd","blockquote","dl"):
            self.parts.append("\n")

    def handle_data(self, data):
        if self._skip_stack or self._in_img:
            return
        t = data.strip()
        if t:
            self.parts.append(t + " ")

    def text(self):
        return htmlmod.unescape("".join(self.parts))


def extract_images(doc_block, page_slug):
    results = []
    pattern = re.compile(r'<img\b([^>]*)/?>', re.IGNORECASE)
    for m in pattern.finditer(doc_block):
        attrs = m.group(1)
        src = re.search(r'\bsrc\s*=\s*["\']([^"\']+)["\']', attrs)
        alt = re.search(r'\balt\s*=\s*["\']([^"\']*)["\']', attrs)
        if not src:
            continue
        src_val = src.group(1)
        if not re.search(r'\.(png|jpe?g|webp|gif)(\?|$)', src_val, re.IGNORECASE):
            continue
        full_url = src_val if src_val.startswith("http") else BASE_URL + src_val
        alt_val = alt.group(1).strip() if alt else ""
        # surrounding context for caption (previous heading)
        start = max(0, m.start()-400)
        ctx = doc_block[start:m.start()]
        caption = ""
        head = re.search(r'<h[234][^>]*>(.*?)</h[234]>', ctx, re.DOTALL|re.IGNORECASE)
        if head:
            caption = htmlmod.unescape(re.sub(r'<[^>]+>',' ', head.group(1))).strip()
        # preceding <p> (often acts as caption)
        if not caption:
            ptag = re.search(r'<p[^>]*>(.*?)</p>', ctx, re.DOTALL|re.IGNORECASE)
            if ptag:
                caption = htmlmod.unescape(re.sub(r'<[^>]+>',' ', ptag.group(1))).strip()
        # preceding <td> if in a table
        if not caption:
            td = re.search(r'<td[^>]*><strong>(.*?)</strong>', ctx, re.DOTALL|re.IGNORECASE)
            if td:
                caption = htmlmod.unescape(td.group(1)).strip()
        results.append({
            "src": src_val,
            "full_url": full_url,
            "alt": alt_val,
            "caption": caption,
        })
    return results


def summarize_text(text, max_words=500):
    t = re.sub(r'[ \t]+', ' ', text)
    t = re.sub(r'\n{3,}', '\n\n', t)
    t = t.strip()
    words = re.findall(r'[\u4e00-\u9fff]|[a-zA-Z0-9_\-]+', t)
    if len(words) <= max_words:
        return t
    cutoff = 0
    count = 0
    for i, ch in enumerate(t):
        if re.match(r'[\u4e00-\u9fff]|[a-zA-Z0-9]', ch):
            count += 1
        if count >= max_words:
            cutoff = i
            break
    tail = t[cutoff:]
    m = re.search(r'[。；!?]\s*', tail)
    if m and m.start() < 100:
        cutoff = cutoff + m.start() + 1
    return t[:cutoff].rstrip() + "\n…"


def download(url, dest, timeout=25):
    try:
        r = subprocess.run(
            ["curl", "-sL", "--max-time", str(timeout), "-A",
             "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
             url, "-o", str(dest)],
            capture_output=True, text=True,
        )
        size = dest.stat().st_size if dest.exists() else 0
        return (r.returncode == 0 and size > 200), size
    except Exception:
        return False, 0


report = []
all_images_info = {}
combined_summary_parts = []

for slug, display in PAGES:
    html_path = HTML_DIR / f"{slug}.html"
    if not html_path.exists():
        report.append(f"=== PAGE: {slug} ===\n  [MISSING]\n")
        continue
    raw = html_path.read_text(encoding="utf-8", errors="replace")

    # 文本提取用 <main> 块（只包含正文），避免 nav/footer/header 干扰
    main_block = extract_main_block(raw)
    ex = TextExtractor()
    ex.feed(main_block)
    full_text = ex.text()
    summary = summarize_text(full_text, max_words=600)
    combined_summary_parts.append((slug, summary))

    # 图片提取用 vp-doc block（图片一定在其中）
    block = extract_vp_doc_block(raw)
    imgs = extract_images(block, slug)
    entries = []
    idx = 0
    for im in imgs:
        ext = Path(im["src"]).suffix or ".png"
        idx += 1
        dest = IMG_DIR / f"{slug}-{idx}{ext}"
        if dest.exists() and dest.stat().st_size > 200:
            ok, size = True, dest.stat().st_size
        else:
            ok, size = download(im["full_url"], dest)
        entries.append({
            "n": idx, "path": str(dest), "src": im["src"],
            "alt": im["alt"], "caption": im["caption"],
            "ok": ok, "size": size,
        })
    all_images_info[slug] = entries

    lines = []
    lines.append(f"=== PAGE: {slug} ({display}) ===")
    lines.append("TEXT:")
    lines.append(summary)
    lines.append("")
    lines.append(f"IMAGES: ({len(entries)} found, {sum(1 for e in entries if e['ok'])} downloaded)")
    for e in entries:
        tag = "[OK]" if e["ok"] else "[FAIL]"
        cap = e["alt"] or e["caption"] or "(无描述)"
        lines.append(f"  {tag} {e['path']}  ({e['size']} bytes, {e['size']/1024:.1f}KB)")
        lines.append(f"      alt/caption: {cap}")
    lines.append("")
    report.append("\n".join(lines))

final = []
final.append("#" * 70)
final.append("# WorkBuddy 文档研究 — 全量页面图片+正文提取报告")
final.append("# 抓取时间: 2026-08-25  来源: codebuddy.cn/docs/workbuddy/")
final.append("#" * 70)
final.append("")
final.extend(report)
final.append("=" * 70)
final.append("# 综合汇总 (SUMMARY)")
final.append("=" * 70)
total = sum(len(v) for v in all_images_info.values())
total_ok = sum(1 for v in all_images_info.values() for e in v if e["ok"])
final.append(f"\n图片总数: {total}   下载成功: {total_ok}")
final.append("")
final.append("各页面图片数量:")
for slug, display in PAGES:
    entries = all_images_info.get(slug, [])
    ok = sum(1 for e in entries if e["ok"])
    final.append(f"  {slug:24s} ({display:22s}) : {len(entries):2d} 张 (成功 {ok})")
final.append("")
final.append("-" * 70)
final.append("# 各页面 UI 功能摘要 (FEATURE/UI SUMMARY)")
final.append("-" * 70)
for slug, summary in combined_summary_parts:
    final.append("")
    final.append(f"### {slug}")
    final.append(summary)

out_path = BASE_DIR / "report.txt"
out_path.write_text("\n".join(final), encoding="utf-8")
print("\n".join(final))
print(f"\n[报告已写入 {out_path}]")
