## draft merge-add：多篇草稿合并为一篇多图文

微信没有「合并草稿」专用接口。本命令对每篇源草稿调用 **`draft/get`**，将其中的全部 **`news_item`** 按你指定的顺序拼成 **`articles`**，再调用 **`draft/add`** 生成**一篇新的**多图文草稿。

### 限制与说明

- 单条多图文总篇数不得超过 **8**（常量与微信常见限制一致；若接口报错以官方为准）。
- 每篇合并后的图文需含 **`title`、`content`、`thumb_media_id`**（`article_type` 为 `news` 时）；非 `news` 类型仅做字段透传，若 `draft/add` 报错需自行调整源草稿。
- `draft/get` 返回里的只读字段（如 **`url`**）会在提交前剔除。
- 合并**不会**自动删除源草稿；加 **`--delete-sources`** 会在新草稿创建成功后删除各源草稿（不可恢复）。

### CLI 示例

合并草稿 `MEDIA_A` 与 `MEDIA_B`（先 A 后 B；每篇草稿若是多图文，会按其内部顺序依次追加）：

```bash
dreamai-wechat-cli draft merge-add --media-id MEDIA_A --media-id MEDIA_B
```

stdout 仅输出**新草稿**的 `media_id`（与 `draft add` 一致，便于脚本串联）。

合并后立刻**全员群发**（认证号、IP 白名单等前提见 [mass 文档](mass.md)）：

```bash
dreamai-wechat-cli draft merge-add --media-id A --media-id B --sendall
```

合并后按标签群发：

```bash
dreamai-wechat-cli draft merge-add --media-id A --media-id B --sendall --send-tag-id 2
```

合并成功并删除源草稿：

```bash
dreamai-wechat-cli draft merge-add --media-id A --media-id B --delete-sources
```

### Server

`POST /draft/merge-add`，JSON 示例：

```json
{
  "media_ids": ["MEDIA_A", "MEDIA_B"],
  "delete_sources": false,
  "sendall": true,
  "send_ignore_reprint": 0
}
```

可选：`send_tag_id`、`clientmsgid`。若 `sendall` 为 true，响应含 `mass_sendall` 对象。
