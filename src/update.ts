import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

interface RegistryVersionResponse {
    version: string;
}

function hasVersionField(data: unknown): data is RegistryVersionResponse {
    return typeof data === "object" && data !== null && "version" in data && typeof (data as { version: unknown }).version === "string";
}

function encodePackageName(name: string): string {
    // scoped 包名需要将 "/" 编码为 "%2F"
    return name.replace("/", "%2F");
}

export function getNpmExecutable(): string {
    return process.platform === "win32" ? "npm.cmd" : "npm";
}

export async function resolveRegistryVersion(packageName: string, versionOrTag: string): Promise<string> {
    const encodedName = encodePackageName(packageName);
    const encodedTarget = encodeURIComponent(versionOrTag);
    const url = `https://registry.npmjs.org/${encodedName}/${encodedTarget}`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`查询 npm 版本失败（${res.status}）：${url}`);
    }

    const data = (await res.json()) as unknown;
    if (!hasVersionField(data)) {
        throw new Error(`npm 版本响应异常：${JSON.stringify(data)}`);
    }

    return data.version;
}

export async function runGlobalInstall(packageName: string, versionOrTag: string): Promise<void> {
    const npmCmd = getNpmExecutable();
    const spec = `${packageName}@${versionOrTag}`;

    await new Promise<void>((resolve, reject) => {
        const child = spawn(npmCmd, ["install", "-g", spec], {
            stdio: "inherit",
            shell: false,
        });

        child.on("error", (err) => {
            reject(new Error(`执行 ${npmCmd} 失败：${err.message}`));
        });

        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`自更新失败，退出码 ${code}`));
        });
    });
}

export async function confirmUpdatePrompt(message: string): Promise<boolean> {
    if (!input.isTTY || !output.isTTY) {
        throw new Error("当前终端不支持交互确认，请添加 --yes 跳过确认");
    }

    const rl = createInterface({ input, output });
    try {
        const answer = await rl.question(`${message} [y/N] `);
        const normalized = answer.trim().toLowerCase();
        return normalized === "y" || normalized === "yes";
    } finally {
        rl.close();
    }
}
