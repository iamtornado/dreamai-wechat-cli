#!/usr/bin/env node
import { Command } from "commander";
import { readFile } from "node:fs/promises";
import pkg from "../package.json" with { type: "json" };
import {
    addTheme,
    ClientPublishOptions,
    listThemes,
    prepareRenderContext,
    removeTheme,
    RenderOptions,
    ThemeOptions,
} from "@wenyan-md/core/wrapper";
import { createDebugLog, maskWechatAppId, resolveDebug } from "./debug.js";
import { publishLocalWithDebug, publishServerWithDebug } from "./publishWithDebug.js";
import { getWechatAccessToken } from "./wechat/accessToken.js";
import {
    draftAdd,
    draftBatchGet,
    draftCount,
    draftDelete,
    draftGet,
    draftUpdate,
} from "./wechat/draftApi.js";
import { massSendAllMpnews } from "./wechat/massApi.js";
import { mergeDraftsAdd } from "./wechat/mergeDrafts.js";
import { getInputContent } from "./utils.js";
import { confirmUpdatePrompt, resolveRegistryVersion, runGlobalInstall } from "./update.js";

export function createProgram(version: string = pkg.version): Command {
    const program = new Command();

    program
        .name("dreamai-wechat-cli")
        .description("DreamAI WeChat CLI — Markdown 排版与公众号草稿发布（基于文颜能力）")
        .version(version, "-v, --version", "output the current version")
        .action(() => {
            program.outputHelp();
        });

    const addCommonOptions = (cmd: Command) => {
        return cmd
            .argument("[input-content]", "markdown content (string input)")
            .option("-f, --file <path>", "read markdown content from local file or web URL")
            .option("-t, --theme <theme-id>", "ID of the theme to use", "default")
            .option("-h, --highlight <highlight-theme-id>", "ID of the code highlight theme to use", "solarized-light")
            .option("-c, --custom-theme <path>", "path to custom theme CSS file")
            .option("--mac-style", "display codeblock with mac style", true)
            .option("--no-mac-style", "disable mac style")
            .option("--footnote", "convert link to footnote", true)
            .option("--no-footnote", "disable footnote")
            .option(
                "--debug",
                "将诊断信息写入 stderr（供排查重复草稿/发布失败；也可设环境变量 DREAMAI_WECHAT_DEBUG=1）",
                false,
            );
    };

    const pubCmd = program
        .command("publish")
        .description("Render a markdown file to styled HTML and publish to wechat GZH");

    // 先添加公共选项，再追加 publish 专属选项
    addCommonOptions(pubCmd)
        .option("--server <url>", "Server URL to publish through (e.g. https://api.yourdomain.com)")
        .option("--api-key <apiKey>", "API key for the remote server")
        .action(async (inputContent: string | undefined, options: ClientPublishOptions) => {
            await runCommandWrapper(async () => {
                const debug = resolveDebug((options as ClientPublishOptions & { debug?: boolean }).debug);
                if (options.server) {
                    options.clientVersion = version;
                    const mediaId = await publishServerWithDebug(inputContent, options, getInputContent, debug);
                    console.log(`发布成功，Media ID: ${mediaId}`);
                } else {
                    const mediaId = await publishLocalWithDebug(inputContent, options, getInputContent, debug);
                    console.log(`发布成功，Media ID: ${mediaId}`);
                }
            });
        });

    const draftRoot = program.command("draft").description("微信公众号草稿箱（服务端 API 直连，与官方字段一致）");

    draftRoot
        .command("count")
        .description("获取草稿总数 (draft/count)")
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .option("--debug", "诊断输出到 stderr（或 DREAMAI_WECHAT_DEBUG=1）", false)
        .action(async (opts: { appId?: string; appSecret?: string; debug?: boolean }) => {
            await runCommandWrapper(async () => {
                const log = createDebugLog(resolveDebug(opts.debug));
                log.phase("draft_count_begin", { appIdMasked: maskWechatAppId(opts.appId) });
                const t0 = Date.now();
                const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                const n = await draftCount(token);
                log.phase("draft_count_end", { ms: Date.now() - t0, total_count: n });
                console.log(n);
            });
        });

    draftRoot
        .command("list")
        .description("获取草稿列表 (draft/batchget)")
        .option("-o, --offset <n>", "偏移量", "0")
        .option("-c, --count <n>", "条数 1～20", "20")
        .option("--include-content", "在结果中包含正文 HTML（no_content=0）", false)
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .option("--debug", "诊断输出到 stderr（或 DREAMAI_WECHAT_DEBUG=1）", false)
        .action(
            async (opts: {
                offset: string;
                count: string;
                includeContent: boolean;
                appId?: string;
                appSecret?: string;
                debug?: boolean;
            }) => {
                await runCommandWrapper(async () => {
                    const log = createDebugLog(resolveDebug(opts.debug));
                    const offset = parseInt(opts.offset, 10) || 0;
                    const count = parseInt(opts.count, 10) || 20;
                    const no_content = opts.includeContent ? 0 : 1;
                    log.phase("draft_batchget_begin", { offset, count, no_content, appIdMasked: maskWechatAppId(opts.appId) });
                    const t0 = Date.now();
                    const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                    const data = await draftBatchGet(token, { offset, count, no_content });
                    log.phase("draft_batchget_end", {
                        ms: Date.now() - t0,
                        total_count: data.total_count,
                        item_count: data.item_count,
                        mediaIds: data.item?.map((i) => i.media_id) ?? [],
                    });
                    console.log(JSON.stringify(data, null, 2));
                });
            },
        );

    draftRoot
        .command("get")
        .description("获取单篇草稿详情 (draft/get)")
        .requiredOption("--media-id <id>", "草稿 media_id")
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .option("--debug", "诊断输出到 stderr（或 DREAMAI_WECHAT_DEBUG=1）", false)
        .action(async (opts: { mediaId: string; appId?: string; appSecret?: string; debug?: boolean }) => {
            await runCommandWrapper(async () => {
                const log = createDebugLog(resolveDebug(opts.debug));
                log.phase("draft_get_begin", { media_id: opts.mediaId, appIdMasked: maskWechatAppId(opts.appId) });
                const t0 = Date.now();
                const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                const data = await draftGet(token, opts.mediaId);
                const titles = data.news_item?.map((n) => (typeof n.title === "string" ? n.title : null)) ?? [];
                log.phase("draft_get_end", {
                    ms: Date.now() - t0,
                    newsItemCount: data.news_item?.length ?? 0,
                    titles,
                });
                console.log(JSON.stringify(data, null, 2));
            });
        });

    draftRoot
        .command("delete")
        .description("删除草稿 (draft/delete)，不可恢复")
        .requiredOption("--media-id <id>", "草稿 media_id")
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .option("--debug", "诊断输出到 stderr（或 DREAMAI_WECHAT_DEBUG=1）", false)
        .action(async (opts: { mediaId: string; appId?: string; appSecret?: string; debug?: boolean }) => {
            await runCommandWrapper(async () => {
                const log = createDebugLog(resolveDebug(opts.debug));
                log.phase("draft_delete_begin", { media_id: opts.mediaId, appIdMasked: maskWechatAppId(opts.appId) });
                const t0 = Date.now();
                const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                await draftDelete(token, opts.mediaId);
                log.phase("draft_delete_end", { ms: Date.now() - t0 });
                console.log("ok");
            });
        });

    draftRoot
        .command("update")
        .description("更新草稿中的某一篇文章 (draft/update)")
        .requiredOption("--media-id <id>", "草稿 media_id")
        .requiredOption("--index <n>", "多图文中的位置，首篇为 0")
        .requiredOption("-f, --file <path>", "单篇 articles 对象的 JSON 文件（对应官方 Body.articles）")
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .option("--debug", "诊断输出到 stderr（或 DREAMAI_WECHAT_DEBUG=1）", false)
        .action(
            async (opts: {
                mediaId: string;
                index: string;
                file: string;
                appId?: string;
                appSecret?: string;
                debug?: boolean;
            }) => {
                await runCommandWrapper(async () => {
                    const log = createDebugLog(resolveDebug(opts.debug));
                    const raw = await readFile(opts.file, "utf-8");
                    const articles = JSON.parse(raw) as Record<string, unknown>;
                    if (!articles || typeof articles !== "object") {
                        throw new Error("JSON 须为 articles 对象");
                    }
                    const idx = parseInt(opts.index, 10);
                    log.phase("draft_update_begin", {
                        media_id: opts.mediaId,
                        index: idx,
                        file: opts.file,
                        articleTitle: typeof articles.title === "string" ? articles.title : null,
                        jsonBytes: raw.length,
                        appIdMasked: maskWechatAppId(opts.appId),
                    });
                    const t0 = Date.now();
                    const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                    await draftUpdate(token, {
                        media_id: opts.mediaId,
                        index: idx,
                        articles,
                    });
                    log.phase("draft_update_end", { ms: Date.now() - t0 });
                    console.log("ok");
                });
            },
        );

    draftRoot
        .command("merge-add")
        .description("合并多篇已有草稿为一篇多图文新草稿（draft/get 各篇 news_item → draft/add）")
        .requiredOption(
            "--media-id <id>",
            "源草稿 media_id；按选项出现顺序合并；可写多次，如 --media-id A --media-id B",
            (value: string, prev: string[] | undefined) => (prev ?? []).concat(value),
            [] as string[],
        )
        .option("--delete-sources", "合并成功且新草稿创建成功后，删除各源草稿（不可恢复）", false)
        .option("--sendall", "合并成功后立即全员群发该新草稿（message/mass/sendall）", false)
        .option("--send-tag-id <n>", "与 --sendall 同用：改为按该标签群发（非全员）")
        .option("--send-ignore-reprint <0|1>", "群发参数 send_ignore_reprint（默认 0，仅 --sendall 时生效）", "0")
        .option("--clientmsgid <id>", "群发去重 id（≤32 字节 UTF-8，仅 --sendall 时生效）")
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .option("--debug", "诊断输出到 stderr（或 DREAMAI_WECHAT_DEBUG=1）", false)
        .action(
            async (opts: {
                mediaId: string[];
                deleteSources?: boolean;
                sendall?: boolean;
                sendTagId?: string;
                sendIgnoreReprint: string;
                clientmsgid?: string;
                appId?: string;
                appSecret?: string;
                debug?: boolean;
            }) => {
                await runCommandWrapper(async () => {
                    const log = createDebugLog(resolveDebug(opts.debug));
                    const ids = opts.mediaId ?? [];
                    if (ids.length === 0) {
                        throw new Error("请至少提供一次 --media-id");
                    }
                    log.phase("draft_merge_add_begin", {
                        sourceCount: ids.length,
                        deleteSources: Boolean(opts.deleteSources),
                        sendall: Boolean(opts.sendall),
                        appIdMasked: maskWechatAppId(opts.appId),
                    });
                    const t0 = Date.now();
                    const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                    const merged = await mergeDraftsAdd(token, ids, { deleteSources: opts.deleteSources });
                    log.phase("draft_merge_add_end", {
                        ms: Date.now() - t0,
                        media_id: merged.media_id,
                        articleCount: merged.articleCount,
                    });
                    if (opts.sendall) {
                        const sir = parseInt(opts.sendIgnoreReprint, 10);
                        if (sir !== 0 && sir !== 1) {
                            throw new Error("--send-ignore-reprint 只能为 0 或 1");
                        }
                        const sendTag =
                            opts.sendTagId !== undefined && opts.sendTagId !== ""
                                ? parseInt(opts.sendTagId, 10)
                                : undefined;
                        if (opts.sendTagId !== undefined && opts.sendTagId !== "" && Number.isNaN(sendTag!)) {
                            throw new Error("--send-tag-id 须为数字");
                        }
                        const isToAll = sendTag === undefined;
                        const mass = await massSendAllMpnews(token, {
                            mediaId: merged.media_id,
                            isToAll,
                            tagId: sendTag,
                            sendIgnoreReprint: sir as 0 | 1,
                            clientmsgid: opts.clientmsgid,
                        });
                        console.log(
                            JSON.stringify(
                                {
                                    merged_media_id: merged.media_id,
                                    articleCount: merged.articleCount,
                                    mass_sendall: mass,
                                },
                                null,
                                2,
                            ),
                        );
                    } else {
                        console.log(merged.media_id);
                    }
                });
            },
        );

    draftRoot
        .command("add")
        .description("按原始 JSON 新增草稿 (draft/add)，需自行准备 thumb_media_id 等")
        .requiredOption("-f, --file <path>", "含 articles 数组的请求体 JSON，参见官方「新增草稿」")
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .option("--debug", "诊断输出到 stderr（或 DREAMAI_WECHAT_DEBUG=1）", false)
        .action(async (opts: { file: string; appId?: string; appSecret?: string; debug?: boolean }) => {
            await runCommandWrapper(async () => {
                const log = createDebugLog(resolveDebug(opts.debug));
                const raw = await readFile(opts.file, "utf-8");
                const body = JSON.parse(raw) as { articles?: unknown };
                if (!Array.isArray(body.articles)) {
                    throw new Error("JSON 须包含 articles 数组");
                }
                const arts = body.articles as Record<string, unknown>[];
                log.hint("draft/add 每次成功都会新建一篇草稿；同一 JSON 多次执行会得到多个 media_id。");
                log.phase("draft_add_begin", {
                    file: opts.file,
                    jsonBytes: raw.length,
                    articleCount: arts.length,
                    firstTitles: arts.map((a) => (typeof a.title === "string" ? a.title : null)),
                    appIdMasked: maskWechatAppId(opts.appId),
                });
                const t0 = Date.now();
                const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                const { media_id } = await draftAdd(token, arts);
                log.phase("draft_add_end", { ms: Date.now() - t0, media_id });
                console.log(media_id);
            });
        });

    const massRoot = program.command("mass").description("微信群发（高级接口 message/mass/sendall，需认证号与 IP 白名单）");

    massRoot
        .command("sendall")
        .description("群发图文 mpnews；默认全员，指定 --tag-id 则按标签群发")
        .requiredOption("--media-id <id>", "图文的 media_id（如 publish / draft add 得到的草稿 id）")
        .option("--tag-id <n>", "用户标签 tag_id；若指定则不再全员群发")
        .option("--send-ignore-reprint <0|1>", "转载校验相关，参见官方 send_ignore_reprint（默认 0）", "0")
        .option("--clientmsgid <id>", "可选，≤32 字节（UTF-8），24h 内相同则拒绝重复群发")
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .option("--debug", "诊断输出到 stderr（或 DREAMAI_WECHAT_DEBUG=1）", false)
        .action(
            async (opts: {
                mediaId: string;
                tagId?: string;
                sendIgnoreReprint: string;
                clientmsgid?: string;
                appId?: string;
                appSecret?: string;
                debug?: boolean;
            }) => {
                await runCommandWrapper(async () => {
                    const log = createDebugLog(resolveDebug(opts.debug));
                    const isToAll = opts.tagId === undefined;
                    const tagId = opts.tagId !== undefined ? parseInt(opts.tagId, 10) : undefined;
                    if (!isToAll && Number.isNaN(tagId!)) {
                        throw new Error("--tag-id 须为数字");
                    }
                    const sir = parseInt(opts.sendIgnoreReprint, 10);
                    if (sir !== 0 && sir !== 1) {
                        throw new Error("--send-ignore-reprint 只能为 0 或 1");
                    }
                    log.phase("mass_sendall_begin", {
                        is_to_all: isToAll,
                        tag_id: tagId ?? null,
                        media_id_prefix: opts.mediaId.slice(0, 8),
                        appIdMasked: maskWechatAppId(opts.appId),
                    });
                    const t0 = Date.now();
                    const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                    const result = await massSendAllMpnews(token, {
                        mediaId: opts.mediaId,
                        isToAll,
                        tagId,
                        sendIgnoreReprint: sir as 0 | 1,
                        clientmsgid: opts.clientmsgid,
                    });
                    log.phase("mass_sendall_end", {
                        ms: Date.now() - t0,
                        msg_id: result.msg_id,
                        msg_data_id: result.msg_data_id ?? null,
                    });
                    console.log(JSON.stringify(result, null, 2));
                });
            },
        );

    program
        .command("update")
        .description("自更新到 npm 最新版本（默认 latest）")
        .option("--check", "仅检查可更新版本，不执行安装", false)
        .option("-y, --yes", "跳过交互确认，直接执行更新", false)
        .option("--to <versionOrTag>", "目标版本或 dist-tag（默认 latest）", "latest")
        .action(async (opts: { check?: boolean; yes?: boolean; to?: string }) => {
            await runCommandWrapper(async () => {
                const target = (opts.to ?? "latest").trim() || "latest";
                const latestVersion = await resolveRegistryVersion(pkg.name, target);

                console.log(`当前版本: ${version}`);
                console.log(`目标版本(${target}): ${latestVersion}`);

                if (opts.check) {
                    return;
                }
                if (latestVersion === version) {
                    console.log("已是目标版本，无需更新。");
                    return;
                }

                if (!opts.yes) {
                    const confirmed = await confirmUpdatePrompt(`确认更新 ${pkg.name}：${version} -> ${latestVersion} ?`);
                    if (!confirmed) {
                        console.log("已取消更新。");
                        return;
                    }
                }

                console.log(`开始执行全局更新: ${pkg.name}@${target}`);
                await runGlobalInstall(pkg.name, target);
                console.log("更新完成。请重新打开终端后执行 dreamai-wechat-cli --version 进行确认。");
            });
        });

    const renderCmd = program.command("render").description("Render a markdown file to styled HTML");

    addCommonOptions(renderCmd).action(async (inputContent: string | undefined, options: RenderOptions) => {
        await runCommandWrapper(async () => {
            const debug = resolveDebug((options as RenderOptions & { debug?: boolean }).debug);
            const log = createDebugLog(debug);
            log.phase("render_begin", {
                file: options.file ?? null,
                hasInline: Boolean(inputContent?.length),
                theme: options.theme,
            });
            const t0 = Date.now();
            const { gzhContent } = await prepareRenderContext(inputContent, options, getInputContent);
            log.phase("render_done", {
                ms: Date.now() - t0,
                title: gzhContent.title ?? null,
                htmlChars: (gzhContent.content ?? "").length,
            });
            console.log(gzhContent.content);
        });
    });

    program
        .command("theme")
        .description("Manage themes")
        .option("-l, --list", "List all available themes")
        .option("--add", "Add a new custom theme")
        .option("--name <name>", "Name of the new custom theme")
        .option("--path <path>", "Path to the new custom theme CSS file")
        .option("--rm <name>", "Name of the custom theme to remove")
        .action(async (options: ThemeOptions) => {
            await runCommandWrapper(async () => {
                const { list, add, name, path, rm } = options;
                if (list) {
                    const themes = await listThemes();
                    console.log("内置主题：");
                    themes
                        .filter((theme) => theme.isBuiltin)
                        .forEach((theme) => {
                            console.log(`- ${theme.id}: ${theme.description ?? ""}`);
                        });
                    const customThemes = themes.filter((theme) => !theme.isBuiltin);
                    if (customThemes.length > 0) {
                        console.log("\n自定义主题：");
                        customThemes.forEach((theme) => {
                            console.log(`- ${theme.id}: ${theme.description ?? ""}`);
                        });
                    }
                    return;
                }
                if (add) {
                    await addTheme(name, path);
                    console.log(`主题 "${name}" 已添加`);
                    return;
                }
                if (rm) {
                    await removeTheme(rm);
                    console.log(`主题 "${rm}" 已删除`);
                }
            });
        });

    program
        .command("serve")
        .description("Start a server to provide HTTP API for rendering and publishing")
        .option("-p, --port <port>", "Port to listen on (default: 3000)", "3000")
        .option("--api-key <apiKey>", "API key for authentication")
        .action(async (options: { port?: string; apiKey?: string }) => {
            try {
                const { serveCommand } = await import("./commands/serve.js");
                const port = options.port ? parseInt(options.port, 10) : 3000;
                await serveCommand({ port, version, apiKey: options.apiKey });
            } catch (error: any) {
                console.error(error.message);
                process.exit(1);
            }
        });

    return program;
}

// --- 统一的错误处理包装器 ---
async function runCommandWrapper(action: () => Promise<void>) {
    try {
        await action();
    } catch (error) {
        if (resolveDebug(false)) {
            const msg = error instanceof Error ? error.stack ?? error.message : String(error);
            console.error("[dreamai-wechat-cli debug] fatal:", msg);
        }
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.error("An unexpected error occurred:", error);
        }
        process.exit(1);
    }
}

const program = createProgram();

program.parse(process.argv);
