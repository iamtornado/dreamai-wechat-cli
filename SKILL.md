# dreamai-wechat-cli 发布指南（DreamAI 分支）

## 准备工作

**图文（`publish`）**：准备 Markdown 文章，含 frontmatter（标题、封面等）。CLI 会自动上传图片到微信素材库。

**贴图（`newspic publish`，v2.1.0+）**：准备标题、描述文本与本地图片；**不需要 Markdown**。可用 `--from-dir` 从目录读取 `wechat_post.json` + 有序图片（如 `panel_01.png`…）。

## 安装与升级

从 **npm registry** 安装（下游集成请用全局 CLI，勿引用仓库 `dist/cli.js`）：

```bash
npm install -g @tornadoami/dreamai-wechat-cli
dreamai-wechat-cli --version
```

升级：

```bash
dreamai-wechat-cli update --yes
# 或
npm install -g @tornadoami/dreamai-wechat-cli@latest
```

## 发布图文（Markdown → 草稿）

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

### 从本地文件读取并发布（图文）

```bash
dreamai-wechat-cli publish -f article.md
```

## 发布贴图（newspic → 草稿箱）

官方 `article_type=newspic`，上传永久素材后调用 [draft/add](https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_add.html)。**仅进草稿箱，不群发**。详见 [docs/newspic.md](docs/newspic.md)。

```bash
# 从目录（wechat_post.json + panel_*.png）
dreamai-wechat-cli newspic publish --from-dir /path/to/post_bundle

# 手动指定
dreamai-wechat-cli newspic publish \
  --title "标题（建议≤20字）" \
  --content "贴图描述正文" \
  --image ./01.png --image ./02.png
```

| 参数 | 说明 |
| --- | --- |
| `--from-dir` | 读目录内 `wechat_post.json`（title、description）与 `panel_*.png` |
| `--max-title-chars` | 默认 20（贴图标题建议） |
| `--app-id` / `--app-secret` | 覆盖 `WECHAT_APP_ID` / `WECHAT_APP_SECRET` |

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

## Frontmatter 要求（仅 `publish` 图文）

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

### 贴图：`invalid media_id`（40007）

图片须为**永久素材**的 `image_media_id`。请使用 `newspic publish`（内部走 `material/add_material`），勿混用临时素材 ID。

### 贴图：封面尺寸不合法（53401）

勿手写无效 `cover_info`；请升级至 ≥2.1.0 并使用官方 CLI 默认 payload。

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
