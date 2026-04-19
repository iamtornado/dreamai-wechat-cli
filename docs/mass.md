## mass：高级群发（全员 / 按标签）

封装微信公众平台 **[根据标签群发消息 `message/mass/sendall`](https://developers.weixin.qq.com/doc/subscription/api/notify/message/api_sendall.html)** 的 **`msgtype=mpnews`** 场景：`media_id` 通常来自 **`publish`** 或 **`draft add`** 得到的草稿图文。

### 前提

- 公众号需具备官方文档所述的接口权限（文档标注为**仅认证**账号等限制，以微信后台为准）。
- 调用机器 IP 在公众号 **IP 白名单** 内。
- 群发为**异步任务**：接口返回成功仅表示任务已提交；完成结果以官方事件 **`MASSSENDJOBFINISH`** 等机制为准。
- 若 `media_id` 来自草稿箱，群发成功后该草稿可能被移除、`media_id` 失效（见官方说明）。

若内容分散在多篇草稿里，可先 **`draft merge-add`**（见 [draft-merge.md](draft-merge.md)）再 **`mass sendall`**，或使用 **`draft merge-add ... --sendall`** 一步完成。

### CLI：默认全员

```bash
dreamai-wechat-cli mass sendall --media-id <草稿图文的 media_id>
```

### 按标签群发（可选）

```bash
dreamai-wechat-cli mass sendall --media-id <media_id> --tag-id 2
```

### 其他参数

| 参数 | 说明 |
| --- | --- |
| `--send-ignore-reprint 0\|1` | 默认 `0`，含义见官方 `send_ignore_reprint` |
| `--clientmsgid <id>` | 可选，≤32 字节（UTF-8），24h 内防重复提交 |
| `--app-id` / `--app-secret` | 覆盖环境变量 `WECHAT_APP_ID` / `WECHAT_APP_SECRET` |
| `--debug` | 诊断日志到 stderr |

成功时 stdout 会打印 JSON，含 `msg_id`、`msg_data_id`（若有）。

### Server 模式

若使用 `dreamai-wechat-cli serve`，可 `POST /mass/sendall`，JSON 示例：

```json
{
  "media_id": "YOUR_MEDIA_ID",
  "send_ignore_reprint": 0
}
```

按标签时增加 `"tag_id": 2`；可选 `"clientmsgid": "your-key"`。
