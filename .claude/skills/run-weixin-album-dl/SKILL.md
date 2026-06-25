---
name: run-weixin-album-dl
description: 下载微信公众号合集（专辑）文章 — 获取文章列表，下载含图片的完整正文，生成 Markdown 索引。适用于下载微信专辑、抓取微信公众号文章、拉取 mp.weixin.qq.com 内容或续传中断的下载。
---

# weixin-album-dl

下载微信公众号合集全部文章（含正文和图片），生成 Markdown 索引。

- **零外部依赖**：仅需 Node.js >= 18，无需 `npm install`，无需 Chrome/浏览器
- **文章列表**：通过微信公开 API (`mp.weixin.qq.com/mp/appmsgalbum`) 获取，无需登录/Cookie
- **文章正文 + 图片**：直接 HTTP 抓取，内置 HTML → Markdown 转换
- **断点续传**：中断后重跑自动跳过已下载

## 前置要求

```bash
node --version   # >= 18（需要内置 fetch 支持）
```

仅此而已。无需安装任何 npm 包，无需 Chrome 浏览器。

## 用法

入口：项目根目录下的 `weixin-album-dl.mjs`

### 1. 完整下载合集

```bash
node weixin-album-dl.mjs \
  --url "https://mp.weixin.qq.com/mp/appmsgalbum?__biz=xxx&action=getalbum&album_id=xxx&scene=21#wechat_redirect"
```

### 2. 增量续传（断点续传）

传入已有的索引 MD 文件，自动跳过 `本地路径` 列已有值的文章：

```bash
node weixin-album-dl.mjs \
  --url "./weixin-albums/合集名称/合集名称.md"
```

### 3. 自定义输出目录

```bash
node weixin-album-dl.mjs \
  --url "合集URL" \
  --output ./my-articles
```

### 4. 只下载文字，跳过图片

```bash
node weixin-album-dl.mjs \
  --url "合集URL" \
  --no-images
```

## 选项

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--url <URL\|FILE>` | 微信合集页面 URL 或已有索引 MD 文件路径（增量续传） | 必填 |
| `--output <dir>` | 输出目录 | `./weixin-albums` |
| `--batch-size <n>` | 每次 API 请求获取的文章数（最大 20） | `20` |
| `--no-images` | 只下载文字，不下载图片 | 关闭 |
| `--help`, `-h` | 显示帮助信息 | — |

## 输出结构

```
weixin-albums/
└── <合集名称>/
    ├── <合集名称>.md              # 索引（Markdown 表格：序号、标题、URL、本地路径、发布时间）
    ├── <文章标题1>/
    │   ├── <文章标题1>.md         # 文章正文（Markdown）
    │   └── images/
    │       ├── img_001.png
    │       └── ...
    └── <文章标题2>/
        └── ...
```

## 技术说明

- **合集 API**：`mp.weixin.qq.com/mp/appmsgalbum?action=getalbum` — 公开接口，无需认证，Cursor 分页
- **正文获取**：直接 HTTP `fetch` 文章 URL，解析 `js_content` 提取正文，`og:title` 提取标题
- **格式转换**：内置 HTML → Markdown 转换器，处理标题、图片、链接、列表、引用等常见元素
- **图片下载**：自动下载 `data-src` 图片到本地 `images/` 目录，Markdown 中替换为相对路径
- **限流保护**：翻页与下载间自动等待 1.5-3.5 秒随机延迟
- **反爬检测**：遇到"环境异常"页面自动跳过，稍后重试

## 注意事项

- **URL 必须用引号包裹。** zsh/bash 会把 `&` 解析为后台运行符。始终使用 `--url "https://..."`。
- **全公开操作。** 合集 API 和文章页面均无需登录/Cookie/Chrome。
- **翻页过快会触发限流。** 每页之间自动等待 1.5-3.5 秒。若仍遇到 `ret=10004`，减小 `--batch-size`。
- **文件名安全处理。** 文章标题中的特殊字符（`< > : " / \ | ? *`）会被替换为 `_`。

## 故障排除

| 问题 | 原因 | 解决 |
|------|------|------|
| `ret=10004` | 限流或游标越界 | 减小 `--batch-size`，等待后重试 |
| `zsh: parse error near '&'` | URL 未加引号 | 用双引号包裹 URL |
| `环境异常` | 触发微信反爬 | 等待几分钟后重试，已自动跳过该篇 |
| 文章正文提取为空 | 页面结构变化 | 检查 `js_content` 是否存在 |

