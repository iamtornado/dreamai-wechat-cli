# dreamai-wechat-cli 发布指南（DreamAI 分支）

## 准备工作

你需要准备一篇 Markdown 格式的文章，包含必要的 frontmatter（标题、封面等元数据）。如果文章内包含图片，确保图片路径正确且可访问，CLI 会自动上传图片到微信公众号素材库。

## 安装 dreamai-wechat-cli

从 npm registry 安装：

```bash
npm install -g @tornadoami/dreamai-wechat-cli
```

确认安装成功：

```bash
dreamai-wechat-cli --version
```

## 发布文章

发布文章的基本命令如下：

```bash
dreamai-wechat-cli publish [options]
```

### 命令参数说明

| 参数             | 简写 | 说明                 | 必填 | 默认值             |
| -------------- | -- | ------------------ | -- | --------------- |
| --file         | -f | Markdown 文件路径      | 否¹ | -               |
| --theme        | -t | 排版主题               | 否  | default         |
| --highlight    | -h | 代码高亮主题             | 否  | solarized-light |
| --custom-theme | -c | 自定义主题 CSS（本地或 URL） | 否  | -               |
| --no-mac-style | -  | 禁用代码块 Mac 风格       | 否  | 启用              |
| --no-footnote  | -  | 禁用脚注转换             | 否  | 启用              |
| --server       | -  | Wenyan Server 地址   | 否  | -               |
| --api-key      | -  | Server API Key     | 否² | -               |
| --debug        | -  | 输出诊断日志到 stderr（或使用 `DREAMAI_WECHAT_DEBUG=1`） | 否  | 关闭              |
| --help         | -  | 查看帮助               | 否  | -               |

### 从本地文件读取并发布

```bash
dreamai-wechat-cli publish -f article.md
```

### 全员群发图文（高级接口）

将已写入草稿箱的图文 `media_id` 提交为**全员**群发任务（微信 `message/mass/sendall`，`mpnews`）：

```bash
dreamai-wechat-cli mass sendall --media-id <上一步 publish 或 draft add 输出的 media_id>
```

按标签群发时增加 `--tag-id <数字>`。说明与限制见仓库内 [docs/mass.md](docs/mass.md) 与[官方文档](https://developers.weixin.qq.com/doc/subscription/api/notify/message/api_sendall.html)。

### 合并多篇已有草稿再群发

将多篇草稿合并为一篇多图文新草稿（内部多次 `draft/get` + 一次 `draft/add`），默认不删源草稿：

```bash
dreamai-wechat-cli draft merge-add --media-id <id1> --media-id <id2>
```

合并并立刻全员群发：

```bash
dreamai-wechat-cli draft merge-add --media-id <id1> --media-id <id2> --sendall
```

详见 [docs/draft-merge.md](docs/draft-merge.md)。

### 指定排版主题

```bash
dreamai-wechat-cli publish -f article.md -t orangeheart
```

### 指定代码高亮主题

```bash
dreamai-wechat-cli publish -f article.md -h solarized-light
```

## 主题管理

主题管理的基本命令如下：

```bash
dreamai-wechat-cli theme [options]
```

### 命令参数说明
| 参数              | 简写 | 说明                                                                 | 必填 | 默认值       |
|-------------------|------|----------------------------------------------------------------------|------|--------------|
| --list            | -l   | 列出所有可用主题（内置 + 自定义）                  | 否  | -            |
| --add            | -   | 触发添加自定义主题操作                   | 否（添加主题时必填）  | -            |
| --name            | -   | 自定义主题名称（唯一标识）                  | 是（仅 `--add` 生效时）  | -            |
| --path            | -   | 主题 CSS 文件路径（本地绝对 / 相对路径、网络 URL）                   |  是（仅 `--add` 生效时）  | -            |
| --rm            | -   | 删除指定名称的自定义主题                  | 否（删除主题时必填）  | -            |


###  列出可使用的主题

```bash
dreamai-wechat-cli theme -l
```

## Frontmatter 要求

建议在 Markdown 顶部包含一段 frontmatter：

```
---
title: 文章标题
cover: ./cover.jpg
author: 作者名称
source_url: https://example.com
---
```

字段说明：

| 字段         | 必填 | 说明                |
| ---------- | -- | ----------------- |
| title      | 是  | 文章标题              |
| cover      | 否  | 封面图片（本地路径或网络 URL） |
| author     | 否  | 作者                |
| source_url | 否  | 原文链接              |

说明：

* 如果未指定 cover，将自动使用正文第一张图片作为封面
* cover 支持本地路径和网络 URL
* 发布成功前，最终内容仍需包含有效 `title` 与 `cover`（`cover` 可由渲染流程自动推导）

## 常见问题

### 图片上传失败

请检查：

* 图片路径是否正确
* 图片文件是否存在
* 图片格式是否支持（jpg、png、gif）

### 发布失败：invalid ip

说明当前机器 IP 未加入微信公众号白名单。

解决方法：

登录微信公众号后台，将当前 IP 加入微信公众号白名单。

### 发布失败：invalid appid or secret

请在环境变量中设置以下变量：

```bash
WECHAT_APP_ID
WECHAT_APP_SECRET
```

### 疑似重复草稿 / 需要排查发布过程

可开启诊断日志：

```bash
dreamai-wechat-cli publish -f article.md --debug
# 或
DREAMAI_WECHAT_DEBUG=1 dreamai-wechat-cli publish -f article.md
```

`draft` 子命令同样支持 `--debug`。
