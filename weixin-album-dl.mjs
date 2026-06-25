#!/usr/bin/env node

/**
 * weixin-album-dl — 微信公众号合集下载器
 * ==========================================
 * 下载微信公众号合集全部文章（含正文和图片），生成 Markdown 索引。
 *
 * 全部通过公开接口，零外部依赖，无需登录/Cookie/Chrome。
 *
 * 项目地址: https://github.com/SlowGrowth1314/weixin-album-dl
 * 原始项目: https://github.com/SlowGrowth1314/opencli-weixin-album
 *
 * 用法:
 *   node weixin-album-dl.mjs --url "合集URL" [--output ./weixin-albums] [--batch-size 20]
 *   node weixin-album-dl.mjs --url "./weixin-albums/合集名/合集名.md"  # 增量续传
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================
// 命令行
// ============================================================

function parseArgs() {
  const raw = process.argv.slice(2);
  const opts = { url: '', output: './weixin-albums', batchSize: 20, noImages: false };
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '--url')           opts.url = raw[++i];
    else if (raw[i] === '--output')    opts.output = raw[++i];
    else if (raw[i] === '--batch-size') opts.batchSize = Math.min(parseInt(raw[++i], 10) || 20, 20);
    else if (raw[i] === '--no-images')  opts.noImages = true;
    else if (raw[i] === '--help' || raw[i] === '-h') { showHelp(); process.exit(0); }
    else if (!raw[i].startsWith('-'))  opts.url = raw[i];
  }
  return opts;
}

function showHelp() {
  console.log(`
weixin-album-dl — 下载微信公众号合集全部文章（含正文和图片）

用法:
  node weixin-album-dl.mjs --url <合集URL|索引文件路径> [选项]

选项:
  --url <url>       微信合集页面 URL，或已有 .md 索引文件（增量续传）
  --output <dir>    输出目录，默认 ./weixin-albums
  --batch-size <n>  每次 API 请求数量，最大 20（默认 20）
  --no-images       只下载文字，不下载图片

示例:
  node weixin-album-dl.mjs --url "https://mp.weixin.qq.com/mp/appmsgalbum?__biz=xxx&album_id=123"
  node weixin-album-dl.mjs --url "./weixin-albums/Skills攻略/Skills攻略.md"
`);
}

// ============================================================
// 工具
// ============================================================

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeName(s) {
  return s.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function parseAlbumUrl(rawUrl) {
  let url = rawUrl.trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'")))
    url = url.slice(1, -1).trim();
  if (url.startsWith('mp.weixin.qq.com/') || url.startsWith('//mp.weixin.qq.com/'))
    url = 'https://' + url.replace(/^\/+/, '');
  try {
    const p = new URL(url);
    if (p.hostname !== 'mp.weixin.qq.com') return null;
    const biz = p.searchParams.get('__biz');
    const albumId = p.searchParams.get('album_id');
    if (!biz || !albumId) return null;
    return { biz, albumId };
  } catch { return null; }
}

function isLocalIndexPath(rawUrl) {
  let p = rawUrl.trim();
  if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'")))
    p = p.slice(1, -1).trim();
  if (p.endsWith('.md') && fs.existsSync(p)) return path.resolve(p);
  return null;
}

// ============================================================
// 微信合集 API（公开）
// ============================================================

async function fetchAlbumPage(biz, albumId, count, cursor) {
  let url = `https://mp.weixin.qq.com/mp/appmsgalbum?action=getalbum&__biz=${encodeURIComponent(biz)}&album_id=${encodeURIComponent(albumId)}&count=${count}&f=json`;
  if (cursor) url += `&begin_msgid=${cursor.msgid}&begin_itemidx=${cursor.itemidx}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest' } });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  const data = await res.json();
  if (data.base_resp?.ret !== 0) throw new Error(`API ret=${data.base_resp?.ret}`);
  return {
    articles: data.getalbum_resp?.article_list || [],
    albumTitle: data.getalbum_resp?.base_info?.title || '',
    continueFlag: data.getalbum_resp?.continue_flag === '1',
  };
}

// ============================================================
// 文章正文下载（直接抓取，无需浏览器）
// ============================================================

async function downloadImages(html, imgDir, noImages) {
  if (noImages) return html;
  fs.mkdirSync(imgDir, { recursive: true });
  const imgs = html.match(/<img[^>]+data-src="([^"]+)"/g) || [];
  let idx = 1;
  for (const tag of imgs) {
    const srcMatch = tag.match(/data-src="([^"]+)"/);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    const ext = src.match(/wx_fmt=(\w+)/)?.[1] || 'jpeg';
    const name = `img_${String(idx).padStart(3, '0')}.${ext}`;
    try {
      const res = await fetch(src, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(path.join(imgDir, name), buf);
        html = html.replace(tag, tag.replace(/data-src="[^"]+"/, `src="images/${name}"`).replace(/src="[^"]*"/, `src="images/${name}"`));
        idx++;
      }
    } catch { /* skip failed images */ }
  }
  return html;
}

function htmlToMd(html, title) {
  let md = `# ${title}\n\n`;

  // Extract body from js_content
  const bodyMatch = html.match(/id="js_content"[^>]*>([\s\S]*?)<\/div>\s*(?:<script|<!--)/);
  if (!bodyMatch) return md + '*(文章内容未能提取)*\n';
  let body = bodyMatch[1];

  // Remove scripts/styles
  body = body.replace(/<script[\s\S]*?<\/script>/g, '');
  body = body.replace(/<style[\s\S]*?<\/style>/g, '');

  // Images → Markdown
  body = body.replace(/<img[^>]+src="([^"]+)"[^>]*>/g, (_, src) => `\n\n![图片](${src})\n\n`);

  // Headers
  body = body.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/g, '\n\n# $1\n\n');
  body = body.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '\n\n## $1\n\n');
  body = body.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '\n\n### $1\n\n');

  // Bold / italic
  body = body.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/g, '**$2**');
  body = body.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/g, '*$2*');

  // Line breaks
  body = body.replace(/<br\s*\/?>/g, '\n');
  body = body.replace(/<\/p>/g, '\n\n');
  body = body.replace(/<\/div>/g, '\n');

  // Links
  body = body.replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)');

  // Blockquote
  body = body.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/g, '\n\n> $1\n\n');

  // Lists
  body = body.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, '- $1\n');

  // Strip remaining tags
  body = body.replace(/<[^>]+>/g, '');

  // Decode entities
  body = body.replace(/&nbsp;/g, ' ');
  body = body.replace(/&lt;/g, '<');
  body = body.replace(/&gt;/g, '>');
  body = body.replace(/&amp;/g, '&');
  body = body.replace(/&quot;/g, '"');
  body = body.replace(/&#39;/g, "'");

  // Clean up whitespace
  body = body.replace(/\n{3,}/g, '\n\n');
  body = body.replace(/^ +/gm, '');
  body = body.replace(/ +$/gm, '');
  body = body.trim();

  return md + body + '\n';
}

async function downloadArticle(articleUrl, outputDir, noImages, fallbackTitle) {
  const res = await fetch(articleUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) return { success: false, localPath: null };
  const html = await res.text();

  // Anti-scraping detection
  if (html.includes('环境异常') || html.includes('当前环境异常')) {
    console.error(`  ⚠️  触发反爬，稍后重试`);
    return { success: false, localPath: null };
  }

  // Extract title: OG meta > <title> tag > fallback
  let title = '';
  const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/);
  if (ogTitle?.[1]?.trim()) title = ogTitle[1].trim();
  if (!title) {
    const tagTitle = html.match(/<title>([^<]+)<\/title>/);
    if (tagTitle?.[1]?.trim() && !tagTitle[1].includes('微信公众平台')) title = tagTitle[1].trim();
  }
  if (!title) title = fallbackTitle || '未命名';

  // Create article directory
  const dirName = safeName(title);
  const artDir = path.join(outputDir, dirName);
  fs.mkdirSync(artDir, { recursive: true });

  // Download images
  const imgDir = path.join(artDir, 'images');
  const processedHtml = await downloadImages(html, imgDir, noImages);

  // Convert to Markdown
  const md = htmlToMd(processedHtml, title);
  const mdPath = path.join(artDir, `${dirName}.md`);
  fs.writeFileSync(mdPath, md, 'utf-8');

  return { success: true, localPath: mdPath };
}

// ============================================================
// 索引文件
// ============================================================

function generateIndex(articles, albumTitle, outputDir) {
  const sName = safeName(albumTitle).replace(/[/\\:*?"<>|]/g, '_');
  const outDir = path.resolve(outputDir, sName);
  fs.mkdirSync(outDir, { recursive: true });
  const indexPath = path.join(outDir, `${sName}.md`);
  const header = '| # | 标题 | URL | 本地路径 | 发布时间 |';
  const sep   = '|---|------|-----|---------|---------|';
  const rows = articles.map((a, i) => {
    const safeUrl = (a.url || '').replace('http://', 'https://');
    const time = a.create_time
      ? new Date(parseInt(a.create_time, 10) * 1000).toISOString().slice(0, 10)
      : '-';
    return `| ${i + 1} | ${a.title} | ${safeUrl} |  | ${time} |`;
  });
  fs.writeFileSync(indexPath, [header, sep, ...rows].join('\n') + '\n', 'utf-8');
  return indexPath;
}

function parseIndexMd(indexPath) {
  const lines = fs.readFileSync(indexPath, 'utf-8').split('\n');
  const entries = [];
  for (const line of lines) {
    if (!line.startsWith('|') || line.includes('---')) continue;
    const cols = line.split('|').map(c => c.trim());
    if (cols.length >= 6 && cols[1] && /^\d+$/.test(cols[1]))
      entries.push({ index: parseInt(cols[1], 10), title: cols[2] || '', url: cols[3] || '', localPath: cols[4] && cols[4] !== '' ? cols[4] : null, publishTime: cols[5] || '' });
  }
  return { albumTitle: path.basename(indexPath, '.md'), entries };
}

function updateMdLocalPath(indexPath, index, localPath) {
  const content = fs.readFileSync(indexPath, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith(`| ${index} |`) || lines[i].startsWith(`| ${index}  |`)) {
      const cols = lines[i].split('|');
      if (cols.length >= 6) { cols[4] = ` ${localPath} `; lines[i] = cols.join('|'); break; }
    }
  }
  fs.writeFileSync(indexPath, lines.join('\n'), 'utf-8');
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  const opts = parseArgs();
  if (!opts.url) { showHelp(); process.exit(1); }

  // ---- 增量模式 ----
  const indexFile = isLocalIndexPath(opts.url);
  if (indexFile) {
    console.error(`\n📋 增量下载: ${indexFile}\n`);
    const { entries } = parseIndexMd(indexFile);
    const outputDir = path.dirname(indexFile);
    const pending = entries.filter(e => !e.localPath);
    const done = entries.filter(e => e.localPath);
    console.error(`📊 已下载 ${done.length}，待下载 ${pending.length}\n`);
    if (pending.length === 0) { console.error('✅ 全部完成\n'); process.exit(0); }

    let ok = done.length;
    for (let i = 0; i < pending.length; i++) {
      const e = pending[i];
      console.error(`[${e.index}/${entries.length}] 📥 ${e.title}`);
      const r = await downloadArticle(e.url, outputDir, opts.noImages, e.title);
      if (r.success) {
        const rel = path.relative(outputDir, r.localPath);
        updateMdLocalPath(indexFile, e.index, rel);
        ok++;
        console.error(`  ✅ ${rel}\n`);
      } else { console.error(`  ❌ 失败\n`); }
      if (i < pending.length - 1) await sleep(1500 + Math.random() * 2000);
    }
    console.error(`✅ 完成: ${ok}/${entries.length}\n📄 ${indexFile}\n`);
    process.exit(0);
  }

  // ---- 完整模式 ----
  const parsed = parseAlbumUrl(opts.url);
  if (!parsed) { console.error('❌ 无效 URL'); process.exit(1); }

  const { biz, albumId } = parsed;
  console.error(`\n📦 合集: ${albumId}`);
  console.error(`📡 拉取文章列表...\n`);

  const allArticles = [];
  let cursor, albumTitle = albumId;
  while (true) {
    const page = await fetchAlbumPage(biz, albumId, opts.batchSize, cursor);
    if (page.articles.length === 0) break;
    if (albumTitle === albumId) { albumTitle = page.albumTitle || albumId; console.error(`📖 ${albumTitle}`); }
    allArticles.push(...page.articles);
    console.error(`  📥 ${allArticles.length} 篇`);
    if (!page.continueFlag) break;
    cursor = { msgid: page.articles[page.articles.length - 1].msgid, itemidx: page.articles[page.articles.length - 1].itemidx };
    await sleep(1500 + Math.random() * 2000);
  }
  console.error(`\n✅ 共 ${allArticles.length} 篇\n`);

  // 生成索引
  const indexPath = generateIndex(allArticles, albumTitle, opts.output);
  console.error(`📄 索引: ${indexPath}\n`);

  // 下载正文
  console.error(`📥 下载文章正文...\n`);
  const outDir = path.resolve(opts.output, safeName(albumTitle).replace(/[/\\:*?"<>|]/g, '_'));
  let ok = 0;
  for (let i = 0; i < allArticles.length; i++) {
    const a = allArticles[i]; const num = i + 1;
    console.error(`[${num}/${allArticles.length}] 📥 ${a.title}`);
    const r = await downloadArticle(a.url, outDir, opts.noImages, a.title);
    if (r.success) {
      const rel = path.relative(outDir, r.localPath);
      updateMdLocalPath(indexPath, num, rel);
      ok++;
      console.error(`  ✅ ${rel}\n`);
    } else { console.error(`  ❌ 失败\n`); }
    if (i < allArticles.length - 1) await sleep(2000 + Math.random() * 2000);
  }
  console.error(`✅ 完成: ${ok}/${allArticles.length}\n📄 ${indexPath}\n`);
}

main().catch(err => { console.error(`❌ ${err.message}`); process.exit(1); });
