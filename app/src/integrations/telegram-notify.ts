// Сповіщення про новий лід у Telegram-чат менеджерів (Bot API, sendMessage).
// Месенджер — це система сповіщення, тому email і телефон ліда сюди не потрапляють.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import type { Integration, Lead, Result } from "../core/types.js";

export function formatTelegramMessage(lead: Lead): string {
  const budget = lead.budgetUsd === undefined ? "бюджет не вказано" : `бюджет $${lead.budgetUsd}`;
  return `Новий лід: ${lead.name} · ${lead.source} · ${budget}`;
}

export const telegramNotify: Integration = {
  name: "telegram-notify",
  requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],

  async send(lead: Lead): Promise<Result<void>> {
    const botToken = readEnv("TELEGRAM_BOT_TOKEN");
    if (!botToken.ok) return botToken;

    const chatId = readEnv("TELEGRAM_CHAT_ID");
    if (!chatId.ok) return chatId;

    const url = `https://api.telegram.org/bot${botToken.value}/sendMessage`;
    const response = await postJson(url, {
      chat_id: chatId.value,
      text: formatTelegramMessage(lead),
    });
    if (!response.ok) {
      log.error(`telegram-notify: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    log.info(`telegram-notify: lead ${lead.id} delivered`);
    return { ok: true, value: undefined };
  },
};
