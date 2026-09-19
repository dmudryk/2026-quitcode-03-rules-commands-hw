import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { formatTelegramMessage, telegramNotify } from "./telegram-notify.js";

const BOT_TOKEN = "123456789:AAFakeTelegramTokenForTests00000";
const CHAT_ID = "-1000000000000";
const SEND_MESSAGE_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

const lead: Lead = {
  id: "ld_0003",
  name: "Марія Тестова",
  email: "mariia@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "referral",
  budgetUsd: 2500,
  createdAt: "2026-09-10T10:15:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("TELEGRAM_BOT_TOKEN", BOT_TOKEN);
  vi.stubEnv("TELEGRAM_CHAT_ID", CHAT_ID);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("telegram-notify", () => {
  it("надсилає повідомлення в sendMessage без email і телефону", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(telegramNotify.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(SEND_MESSAGE_URL);

    const body = String(init?.body);
    expect(JSON.parse(body)).toEqual({ chat_id: CHAT_ID, text: formatTelegramMessage(lead) });
    expect(body).toContain("Марія Тестова");
    expect(body).toContain("referral");
    expect(body).toContain("2500");
    expect(body).not.toContain(lead.email);
    expect(body).not.toContain("+380");
  });

  it("повертає помилку, якщо не задано змінну середовища", async () => {
    const fetchMock = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_BOT_TOKEN",
    });

    vi.stubEnv("TELEGRAM_BOT_TOKEN", BOT_TOKEN);
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable TELEGRAM_CHAT_ID",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("повертає помилку, якщо Bot API відповів помилкою", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"ok":false,"error_code":400,"description":"chat not found"}', { status: 400 })),
    );

    await expect(telegramNotify.send(lead)).resolves.toEqual({
      ok: false,
      error: `POST ${SEND_MESSAGE_URL} failed: HTTP 400`,
    });
  });
});
