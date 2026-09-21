// Створює контакт у Pipedrive CRM (endpoint `POST /persons`).
// CRM — це система обліку, тому сюди йдуть повні дані ліда, включно з email і телефоном.
// Токен передаємо заголовком `x-api-token`, а не параметром `?api_token=`: redact() у
// core/log.ts маскує `token`/`key`/`api_key`/`access_token`, але не `api_token`, і при
// збої URL із токеном потрапив би в журнал як є.
import { readEnv } from "../core/config.js";
import { postJson } from "../core/http.js";
import { log } from "../core/log.js";
import { isNumber, isRecord, parseJson } from "../core/parse.js";
import type { Integration, Lead, Result } from "../core/types.js";

/** Конверт відповіді Pipedrive: `{ "success": true, "data": { "id": 42 } }`. */
interface PipedrivePersonResponse {
  success: boolean;
  data: { id: number };
}

const isPipedrivePersonResponse = (value: unknown): value is PipedrivePersonResponse =>
  isRecord(value) &&
  typeof value.success === "boolean" &&
  isRecord(value.data) &&
  isNumber(value.data.id);

export const pipedrivePerson: Integration = {
  name: "pipedrive-person",
  requiredEnv: ["PIPEDRIVE_API_URL", "PIPEDRIVE_API_TOKEN"],

  async send(lead: Lead): Promise<Result<void>> {
    const apiUrl = readEnv("PIPEDRIVE_API_URL");
    if (!apiUrl.ok) return apiUrl;

    const apiToken = readEnv("PIPEDRIVE_API_TOKEN");
    if (!apiToken.ok) return apiToken;

    const url = `${apiUrl.value}/persons`;
    const response = await postJson(
      url,
      {
        name: lead.name,
        email: [{ value: lead.email, primary: true, label: "work" }],
        // Телефон необов'язковий у Lead — відсутній не підставляємо порожнім рядком,
        // щоб у CRM не з'являвся пустий контактний запис.
        ...(lead.phone === undefined ? {} : { phone: [{ value: lead.phone, primary: true, label: "work" }] }),
      },
      { headers: { "x-api-token": apiToken.value } },
    );
    if (!response.ok) {
      log.error(`pipedrive-person: lead ${lead.id} not delivered: ${response.error}`);
      return response;
    }

    const parsed = parseJson(response.value, isPipedrivePersonResponse, "pipedrive-person");
    if (!parsed.ok) {
      log.error(`pipedrive-person: lead ${lead.id} not delivered: ${parsed.error}`);
      return parsed;
    }

    if (!parsed.value.success) {
      log.error(`pipedrive-person failed: ${url} -> success=false`);
      return { ok: false, error: "pipedrive error: person not created" };
    }

    log.info(`pipedrive-person: person ${parsed.value.data.id} created for lead ${lead.id}`);
    return { ok: true, value: undefined };
  },
};
