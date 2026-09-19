// Додає рядок із лідом у Google-таблицю через вебхук «Leads → Google Sheets».
// Перенесено з n8n і приведено до конвенцій проєкту без зміни поведінки.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isRecord, isString, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

/** Відповідь вебхука таблиці: `{ "status": "ok" }` або код помилки в `status`. */
interface SheetsResponse {
  status: string;
}

const isSheetsResponse = (value: unknown): value is SheetsResponse =>
  isRecord(value) && isString(value.status);

const sheetsAppend: Integration = {
  name: "sheets-append",
  requiredEnv: ["SHEETS_WEBHOOK_URL", "SHEETS_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const webhookUrl = readEnv("SHEETS_WEBHOOK_URL");
    if (!webhookUrl.ok) return webhookUrl;

    const token = readEnv("SHEETS_TOKEN");
    if (!token.ok) return token;

    const url = `${webhookUrl.value}?token=${token.value}`;
    const response = await postJson(url, {
      values: [[lead.createdAt, lead.name, lead.email, lead.phone ?? "", lead.source]],
    });
    if (!response.ok) {
      log.error(`sheets-append: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isSheetsResponse, "sheets-append");
    if (!parsed.ok) {
      log.error(`sheets-append: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    if (parsed.value.status !== "ok") {
      log.error(`sheets-append failed: ${url} -> ${parsed.value.status}`);
      return { ok: false, error: `sheets error: ${parsed.value.status}` };
    }

    log.info(`sheets-append: row added for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};

export default sheetsAppend;
