import { createHash, randomUUID } from "node:crypto";

/** 可由环境变量开启，便于 Agent/CI 无需改参 */
/** 日志中脱敏展示 WECHAT_APP_ID */
export function maskWechatAppId(id?: string): string | null {
    const v = id ?? process.env.WECHAT_APP_ID;
    if (!v) {
        return null;
    }
    if (v.length <= 8) {
        return "***";
    }
    return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export function resolveDebug(cliFlag?: boolean): boolean {
    if (cliFlag === true) {
        return true;
    }
    const v = process.env.DREAMAI_WECHAT_DEBUG?.trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
}

/** 用于判断「是否同一次意图的重复 publish」：同一 frontmatter+正文会得到相同 fingerprint */
export function contentFingerprint(title: string, html: string, sourceUrl?: string): string {
    return createHash("sha256")
        .update(title)
        .update("\u0000")
        .update(sourceUrl ?? "")
        .update("\u0000")
        .update(html)
        .digest("hex")
        .slice(0, 16);
}

export interface DebugLogger {
    readonly runId: string;
    readonly enabled: boolean;
    phase(phase: string, data?: Record<string, unknown>): void;
    hint(message: string): void;
}

export function createDebugLog(enabled: boolean): DebugLogger {
    const runId = randomUUID();
    const p = "[dreamai-wechat-cli debug]";

    return {
        runId,
        enabled,
        phase(phase, data) {
            if (!enabled) {
                return;
            }
            const payload = data !== undefined ? ` ${JSON.stringify(data)}` : "";
            console.error(`${p} ${new Date().toISOString()} run=${runId} phase=${phase}${payload}`);
        },
        hint(message) {
            if (!enabled) {
                return;
            }
            console.error(`${p} ${new Date().toISOString()} run=${runId} hint=${message}`);
        },
    };
}
