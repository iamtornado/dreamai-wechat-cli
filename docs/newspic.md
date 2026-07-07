## newspic：贴图草稿（图片消息）

将本地图片上传为**永久素材**，并按微信官方 **`draft/add`** 接口创建 **`article_type=newspic`** 草稿（仅进草稿箱，不群发）。

官方文档：[新增草稿](https://developers.weixin.qq.com/doc/subscription/api/draftbox/draftmanage/api_draft_add.html) · [上传永久素材](https://developers.weixin.qq.com/doc/subscription/api/material/permanent/api_addmaterial.html)

### 前提

- 公众号已开通「图片/文字」贴图能力
- 服务器出口 IP 在公众号白名单内
- 环境变量 `WECHAT_APP_ID` / `WECHAT_APP_SECRET`，或 `--app-id` / `--app-secret`

### ComicAutoPub 目录约定

目录内需包含：

- `wechat_post.json` → `title`（≤20 字）、`description`
- `panel_01.png` … `panel_NN.png`（按格序，最多 20 张）

ComicAutoPub 输出目录即符合上述约定，可直接 `--from-dir` 指向。

```bash
dreamai-wechat-cli newspic publish --from-dir /path/to/post_bundle
```

### 手动指定

```bash
dreamai-wechat-cli newspic publish \
  --title "辅导作业被娃气笑！" \
  --content "讲了三遍还不懂？儿子一句反问让老母亲破防……" \
  --image ./panel_01.png \
  --image ./panel_02.png
```

### 参数

| 参数 | 说明 |
| --- | --- |
| `--from-dir <dir>` | 从目录读取 `wechat_post.json` 与 `panel_*.png`（见上方目录约定） |
| `--wechat-post <path>` | 单独指定 wechat_post.json |
| `--title` / `--content` | 覆盖 JSON 中的标题与描述 |
| `--image` | 图片路径，可重复 |
| `--images-dir` | 从目录读取全部图片 |
| `--need-open-comment 0\|1` | 默认 `1` |
| `--only-fans-can-comment 0\|1` | 默认 `0` |
| `--max-title-chars` | 默认 `20`（贴图标题建议） |
| `--debug` | 诊断日志到 stderr |

### 输出

成功时 stdout 打印 JSON，例如：

```json
{
  "status": "drafted",
  "media_id": "MEDIA_ID",
  "title": "贴图标题",
  "image_count": 5
}
```

可在公众号后台「草稿箱」中查看与编辑。每次成功调用都会**新建**一篇草稿。

### 与 `publish` 的区别

| | `publish` | `newspic publish` |
| --- | --- | --- |
| 类型 | 图文 `news`（Markdown→HTML） | 贴图 `newspic`（多图） |
| 图片字段 | `thumb_media_id` + 正文 HTML | `image_info.image_list[].image_media_id` |
| 适用 | 长文排版 | 漫画分镜贴图 |
