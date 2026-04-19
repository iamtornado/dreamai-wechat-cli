import { afterEach, describe, expect, it, vi } from "vitest";
import { massSendAllMpnews } from "../src/wechat/massApi.js";

describe("massSendAllMpnews", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("posts sendall with is_to_all when no tag", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    errcode: 0,
                    errmsg: "send job submission success",
                    msg_id: 34182,
                    msg_data_id: 206227730,
                }),
        });
        vi.stubGlobal("fetch", fetchMock);

        const r = await massSendAllMpnews("TOKEN", { mediaId: "MEDIA123", isToAll: true });

        expect(r.msg_id).toBe(34182);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toContain("/cgi-bin/message/mass/sendall?");
        expect(url).toContain("access_token=TOKEN");
        expect(init.method).toBe("POST");
        const body = JSON.parse(init.body as string);
        expect(body).toMatchObject({
            filter: { is_to_all: true },
            mpnews: { media_id: "MEDIA123" },
            msgtype: "mpnews",
            send_ignore_reprint: 0,
        });
    });

    it("includes tag_id when not to all", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    errcode: 0,
                    errmsg: "send job submission success",
                    msg_id: 1,
                }),
        });
        vi.stubGlobal("fetch", fetchMock);

        await massSendAllMpnews("T", { mediaId: "M", isToAll: false, tagId: 2, sendIgnoreReprint: 1 });

        const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(JSON.parse(init.body as string).filter).toEqual({ is_to_all: false, tag_id: 2 });
        expect(JSON.parse(init.body as string).send_ignore_reprint).toBe(1);
    });

    it("throws on wechat error", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ errcode: 40007, errmsg: "invalid media_id" }),
            }),
        );

        await expect(massSendAllMpnews("T", { mediaId: "bad", isToAll: true })).rejects.toThrow(/40007/);
    });

    it("rejects clientmsgid longer than 32 bytes", async () => {
        vi.stubGlobal("fetch", vi.fn());
        const long = "a".repeat(33);
        await expect(
            massSendAllMpnews("T", { mediaId: "m", isToAll: true, clientmsgid: long }),
        ).rejects.toThrow(/clientmsgid/);
    });
});
