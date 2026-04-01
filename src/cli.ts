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
    renderAndPublish,
    renderAndPublishToServer,
    RenderOptions,
    ThemeOptions,
} from "@wenyan-md/core/wrapper";
import { getWechatAccessToken } from "./wechat/accessToken.js";
import {
    draftAdd,
    draftBatchGet,
    draftCount,
    draftDelete,
    draftGet,
    draftUpdate,
} from "./wechat/draftApi.js";
import { getInputContent } from "./utils.js";

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
            .option("--no-footnote", "disable footnote");
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
                // 如果传入了 --server，则走客户端（远程）模式
                if (options.server) {
                    options.clientVersion = version; // 将 CLI 版本传递给服务器，便于调试和兼容性处理
                    const mediaId = await renderAndPublishToServer(inputContent, options, getInputContent);
                    console.log(`发布成功，Media ID: ${mediaId}`);
                } else {
                    // 走原有的本地直接发布模式
                    const mediaId = await renderAndPublish(inputContent, options, getInputContent);
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
        .action(async (opts: { appId?: string; appSecret?: string }) => {
            await runCommandWrapper(async () => {
                const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                const n = await draftCount(token);
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
        .action(
            async (opts: {
                offset: string;
                count: string;
                includeContent: boolean;
                appId?: string;
                appSecret?: string;
            }) => {
                await runCommandWrapper(async () => {
                    const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                    const data = await draftBatchGet(token, {
                        offset: parseInt(opts.offset, 10) || 0,
                        count: parseInt(opts.count, 10) || 20,
                        no_content: opts.includeContent ? 0 : 1,
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
        .action(async (opts: { mediaId: string; appId?: string; appSecret?: string }) => {
            await runCommandWrapper(async () => {
                const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                const data = await draftGet(token, opts.mediaId);
                console.log(JSON.stringify(data, null, 2));
            });
        });

    draftRoot
        .command("delete")
        .description("删除草稿 (draft/delete)，不可恢复")
        .requiredOption("--media-id <id>", "草稿 media_id")
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .action(async (opts: { mediaId: string; appId?: string; appSecret?: string }) => {
            await runCommandWrapper(async () => {
                const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                await draftDelete(token, opts.mediaId);
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
        .action(
            async (opts: { mediaId: string; index: string; file: string; appId?: string; appSecret?: string }) => {
                await runCommandWrapper(async () => {
                    const raw = await readFile(opts.file, "utf-8");
                    const articles = JSON.parse(raw) as Record<string, unknown>;
                    if (!articles || typeof articles !== "object") {
                        throw new Error("JSON 须为 articles 对象");
                    }
                    const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                    await draftUpdate(token, {
                        media_id: opts.mediaId,
                        index: parseInt(opts.index, 10),
                        articles,
                    });
                    console.log("ok");
                });
            },
        );

    draftRoot
        .command("add")
        .description("按原始 JSON 新增草稿 (draft/add)，需自行准备 thumb_media_id 等")
        .requiredOption("-f, --file <path>", "含 articles 数组的请求体 JSON，参见官方「新增草稿」")
        .option("--app-id <id>", "override WECHAT_APP_ID")
        .option("--app-secret <secret>", "override WECHAT_APP_SECRET")
        .action(async (opts: { file: string; appId?: string; appSecret?: string }) => {
            await runCommandWrapper(async () => {
                const raw = await readFile(opts.file, "utf-8");
                const body = JSON.parse(raw) as { articles?: unknown };
                if (!Array.isArray(body.articles)) {
                    throw new Error("JSON 须包含 articles 数组");
                }
                const token = await getWechatAccessToken({ appId: opts.appId, appSecret: opts.appSecret });
                const { media_id } = await draftAdd(token, body.articles as Record<string, unknown>[]);
                console.log(media_id);
            });
        });

    const renderCmd = program.command("render").description("Render a markdown file to styled HTML");

    addCommonOptions(renderCmd).action(async (inputContent: string | undefined, options: RenderOptions) => {
        await runCommandWrapper(async () => {
            const { gzhContent } = await prepareRenderContext(inputContent, options, getInputContent);
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
