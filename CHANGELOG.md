# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/) 格式。

## [1.0.0] — 2026-06-25

初始版本，从 [opencli-weixin-album](https://github.com/SlowGrowth1314/opencli-weixin-album) 重构为独立的零依赖脚本。

### 新增

- 通过微信公开 API 获取合集全部文章列表（Cursor 分页）
- 下载文章正文并内置 HTML → Markdown 转换
- 自动下载正文图片到本地 `images/` 目录，替换为相对路径
- 生成 Markdown 表格索引（序号、标题、URL、本地路径、发布时间）
- 增量续传模式：传入已有索引 `.md`，自动跳过已下载文章
- 随机 1.5-3.5 秒延迟限流保护
- 反爬检测：自动识别"环境异常"页面并跳过
- `--no-images` 纯文字下载模式
- `--batch-size` 控制 API 分页大小（最大 20）
- `--output` 自定义输出目录
- Claude Code Skill 集成（`.claude/skills/run-weixin-album-dl/SKILL.md`）
