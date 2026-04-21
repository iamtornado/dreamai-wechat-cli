## update：CLI 自更新

`update` 命令用于将全局安装的 `dreamai-wechat-cli` 更新到 npm 上的目标版本（默认 `latest`）。

### 仅检查版本

```bash
dreamai-wechat-cli update --check
```

输出会显示当前版本与目标版本，不执行安装。

### 更新到 latest

```bash
dreamai-wechat-cli update
```

默认会先进行交互确认（`[y/N]`）。

### 跳过确认直接更新

```bash
dreamai-wechat-cli update --yes
```

### 更新到指定版本或 dist-tag

```bash
dreamai-wechat-cli update --to 2.0.3
dreamai-wechat-cli update --to latest
```

### 注意事项

- `update` 内部会执行 `npm install -g @tornadoami/dreamai-wechat-cli@<target>`。
- 需要当前机器具备 npm 全局安装权限（建议使用 nvm 管理 Node 环境）。
- 更新完成后建议新开终端并执行 `dreamai-wechat-cli --version` 验证版本。
- 在非交互终端（CI）中，请使用 `--yes`，否则会提示无法进行交互确认。
