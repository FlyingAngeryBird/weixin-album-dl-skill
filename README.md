# weixin-album-dl

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![Dependencies](https://img.shields.io/badge/dependencies-0-success)]()
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen)](https://github.com/SlowGrowth1314/weixin-album-dl/pulls)

> 批量下载微信公众号合集（专辑）全部文章，含正文和图片，生成 Markdown 索引。
>
> 
## 目录

- [功能](#功能)
- [前置要求](#前置要求)
- [与AI编程工具集成](#与ai编程工具集成)
- [快速开始](#快速开始)
- [用法](#用法)
  - [完整下载](#完整下载)
  - [增量续传（断点续传）](#增量续传断点续传)
  - [自定义输出目录](#自定义输出目录)
  - [只下载文字，跳过图片](#只下载文字跳过图片)
- [选项](#选项)
- [输出结构](#输出结构)
- [工作原理](#工作原理)
- [常见问题](#常见问题)
- [致谢](#致谢)
- [许可证](#许可证)

## 功能

- 📋 **自动获取文章列表** — 通过微信公开 API，无需登录 / Cookie / Chrome
- 📥 **下载正文 + 图片** — 直接 HTTP 抓取，内置 HTML → Markdown 转换
- 🔄 **断点续传** — 中断后重跑自动跳过已下载文章
- 📊 **Markdown 索引** — 生成表格索引，实时回写本地路径
- 🛡️ **内置限流保护** — 翻页和下载间自动等待 1.5-3.5 秒随机延迟
- 🛡️ **反爬检测** — 自动识别"环境异常"页面，跳过并继续

## 前置要求

- **Node.js >= 18**（需要内置 `fetch` 支持）


验证你的 Node 版本：

```bash
node --version
# 必须 >= 18
```

## 与AI编程工具集成

本工具可无缝集成到主流AI编程助手中，让AI助手直接下载和阅读微信公众号文章合集。

### 支持的AI编程工具

✅ **Claude Code** (Anthropic)
✅ **Codex** (OpenAI)
✅ **OpenClaw**
✅ **OpenCode**
✅ **其他支持MCP或命令行调用的AI编程工具**

### 使用方式

在AI编程工具中，直接请求下载微信文章合集：

```
请帮我下载这个微信公众号合集：
https://mp.weixin.qq.com/mp/appmsgalbum?__biz=xxx&action=getalbum&album_id=xxx
```

AI助手会自动：
1. 调用 `weixin-album-dl` 下载文章
2. 将下载的Markdown文件添加到项目上下文
3. 基于文章内容进行分析、总结或回答问题

### 配置方式（可选）

如果需要在特定工具中配置，可将本工具添加为MCP服务器或shell命令：

```json
{
  "mcpServers": {
    "weixin-album-dl": {
      "command": "node",
      "args": ["/path/to/weixin-album-dl.mjs"]
    }
  }
}
```

### 典型使用场景

- 📚 **知识库构建**：下载系列文章作为项目参考资料
- 🔍 **内容分析**：让AI分析、总结、提取关键信息
- 💡 **学习辅助**：基于文章内容生成学习笔记或练习题
- 📝 **文档整理**：将散落的文章整理成结构化文档

## 快速开始

```bash
# 无需安装 — 直接运行
node weixin-album-dl.mjs \
  --url "https://mp.weixin.qq.com/mp/appmsgalbum?__biz=xxx&action=getalbum&album_id=xxx"
```

或者使用 npx（无需 clone 仓库）：

```bash
npx weixin-album-dl \
  --url "https://mp.weixin.qq.com/mp/appmsgalbum?__biz=xxx&action=getalbum&album_id=xxx"
```

## 用法

### 完整下载

```bash
node weixin-album-dl.mjs \
  --url "https://mp.weixin.qq.com/mp/appmsgalbum?__biz=MzI0NTU3NTc5Ng==&action=getalbum&album_id=4482506796406177793&scene=21#wechat_redirect"
```

运行输出：

```
📦 合集: 4482506796406177793
📡 拉取文章列表...

📖 智能体设计模式
  📥 22 篇

✅ 共 22 篇

📄 索引: ./weixin-albums/智能体设计模式/智能体设计模式.md

📥 下载文章正文...

[1/22] 📥 智能体设计模式 - 第一章: 让 AI 不再「一口吃成胖子」
  ✅ 智能体设计模式_-_第一章_让_AI_不再.../智能体设计模式_-_第一章_让_AI_不再....md

[2/22] 📥 智能体设计模式-第二章: 让 AI 学会看情况办事
  ✅ 智能体设计模式-第二章_让_AI_学会.../智能体设计模式-第二章_让_AI_学会....md

...

✅ 完成: 22/22
📄 ./weixin-albums/智能体设计模式/智能体设计模式.md
```

### 增量续传（断点续传）

下载中断后，直接传入已有索引文件继续：

```bash
node weixin-album-dl.mjs \
  --url "./weixin-albums/智能体设计模式/智能体设计模式.md"
```

自动检测已下载文章（`本地路径` 列有值），只下载缺失的：

```
📋 增量下载: ./weixin-albums/智能体设计模式/智能体设计模式.md

📊 已下载 15，待下载 7

[16/22] 📥 智能体设计模式 - 第十六章...
  ✅ 智能体设计模式-第十六章.../智能体设计模式-第十六章....md

...

✅ 完成: 22/22
```

### 自定义输出目录

```bash
node weixin-album-dl.mjs \
  --url "合集URL" \
  --output ./my-articles
```

### 只下载文字，跳过图片

```bash
node weixin-album-dl.mjs \
  --url "合集URL" \
  --no-images
```

## 选项

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `--url <URL\|FILE>` | 是 | — | 微信合集页面 URL，或已有索引 MD 文件路径（增量续传） |
| `--output <dir>` | 否 | `./weixin-albums` | 输出目录 |
| `--batch-size <n>` | 否 | `20` | 每次 API 请求获取的文章数（上限 20） |
| `--no-images` | 否 | 关闭 | 只下载文字，不下载图片 |
| `--help`, `-h` | 否 | — | 显示帮助信息 |

> **注意：** URL 必须用引号包裹，否则 shell 会将 `&` 解析为后台运行符。

## 输出结构

```
weixin-albums/
└── <合集名称>/
    ├── <合集名称>.md              # Markdown 索引（表格形式）
    ├── <文章标题1>/
    │   ├── <文章标题1>.md         # 文章正文（Markdown）
    │   └── images/
    │       ├── img_001.png
    │       └── ...
    └── <文章标题2>/
        └── ...
```

索引文件内容示例：

```markdown
| # | 标题 | URL | 本地路径 | 发布时间 |
|---|------|-----|---------|---------|
| 1 | 智能体设计模式 - 第一章 | https://mp.weixin.qq.com/s?... | 智能体设计模式_-_第一章.../....md | 2026-04-23 |
| 2 | 智能体设计模式 - 第二章 | https://mp.weixin.qq.com/s?... | 智能体设计模式-第二章.../....md | 2026-04-25 |
```

## 工作原理

### 1. 获取文章列表

调用微信公开 API `mp.weixin.qq.com/mp/appmsgalbum?action=getalbum`，使用基于游标（cursor）的分页，无需任何认证即可获取合集全部文章链接。

### 2. 下载文章正文

直接 HTTP `fetch` 文章 URL，解析 HTML：
- 从 `<meta property="og:title">` 或 `<title>` 提取标题
- 从 `<div id="js_content">` 提取正文内容
- 内置转换器将 HTML 转为 Markdown（标题、图片、链接、列表、引用等）

### 3. 下载图片

提取正文中 `data-src` 图片链接，下载到本地 `images/` 目录，Markdown 中替换为相对路径。

### 4. 生成索引

创建 Markdown 表格文件，包含序号、标题、URL、本地路径、发布时间五列。每篇下载完成后自动回写本地路径。

### 5. 增量恢复

再次运行时检测已有索引文件，`本地路径` 列有值的文章自动跳过，只下载缺失部分。

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `ret=10004` | 限流或游标越界 | 减小 `--batch-size`，等待后重试 |
| `zsh: parse error near '&'` | URL 未加引号 | 用双引号包裹 URL |
| `环境异常` / "环境异常" | 触发微信反爬 | 等待几分钟后重试，已自动跳过该篇 |
| 文章正文提取为空 | 页面结构变化 | 检查 `js_content` 是否存在，提交 issue 反馈 |
| `fetch is not defined` | Node 版本 < 18 | 升级到 Node.js >= 18 |

## 致谢

本项目是 [opencli-weixin-album](https://github.com/SlowGrowth1314/opencli-weixin-album) 的独立重构版本。

原项目基于 [opencli](https://github.com/jackwener/opencli) 框架，使用 TypeScript 开发。本版本将核心逻辑提取为一个零依赖的独立 Node.js 脚本，可直接使用，无需 opencli 框架、npm install 或构建步骤。

感谢 [SlowGrowth1314](https://github.com/SlowGrowth1314) 的原始实现并将其开源。

## 许可证

[MIT](./LICENSE)
