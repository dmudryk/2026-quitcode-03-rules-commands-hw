import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lead } from "../core/types.js";
import { pipedrivePerson } from "./pipedrive-person.js";

const API_URL = "https://studio-nova.pipedrive.example.test/api/v1";
const API_TOKEN = "fake-pipedrive-token-0000";
const PERSONS_URL = `${API_URL}/persons`;

const lead: Lead = {
  id: "ld_0004",
  name: "Ігор Тестовий",
  email: "ihor@studio-nova.example.test",
  phone: "+380 (00) 000-00-00",
  source: "website",
  budgetUsd: 7000,
  createdAt: "2026-09-10T11:45:00.000Z",
};

beforeEach(() => {
  vi.stubEnv("PIPEDRIVE_API_URL", API_URL);
  vi.stubEnv("PIPEDRIVE_API_TOKEN", API_TOKEN);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pipedrive-person", () => {
  it("створює контакт із повними даними ліда", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response('{"success":true,"data":{"id":42}}', { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(pipedrivePerson.send(lead)).resolves.toEqual({ ok: true, value: undefined });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(PERSONS_URL);
    expect(init?.method).toBe("POST");

    // CRM — система обліку: email і телефон тут дозволені, на відміну від сповіщень.
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Ігор Тестовий",
      email: [{ value: "ihor@studio-nova.example.test", primary: true, label: "work" }],
      phone: [{ value: "+380 (00) 000-00-00", primary: true, label: "work" }],
    });

    // Токен іде заголовком і не потрапляє в URL, який логує core/http.ts при збої.
    const headers = new Headers(init?.headers);
    expect(headers.get("x-api-token")).toBe(API_TOKEN);
    expect(String(url)).not.toContain(API_TOKEN);
  });

  it("не надсилає телефон, якого немає в ліді", async () => {
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response('{"success":true,"data":{"id":43}}', { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { phone: _phone, ...leadWithoutPhone } = lead;
    await expect(pipedrivePerson.send(leadWithoutPhone)).resolves.toEqual({ ok: true, value: undefined });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Ігор Тестовий",
      email: [{ value: "ihor@studio-nova.example.test", primary: true, label: "work" }],
    });
  });

  it("повертає помилку, якщо не задано змінну середовища", async () => {
    const fetchMock = vi.fn(async () => new Response('{"success":true,"data":{"id":42}}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv("PIPEDRIVE_API_URL", "");
    await expect(pipedrivePerson.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable PIPEDRIVE_API_URL",
    });

    vi.stubEnv("PIPEDRIVE_API_URL", API_URL);
    vi.stubEnv("PIPEDRIVE_API_TOKEN", "");
    await expect(pipedrivePerson.send(lead)).resolves.toEqual({
      ok: false,
      error: "missing environment variable PIPEDRIVE_API_TOKEN",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("повертає помилку, якщо Pipedrive відповів помилкою", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"success":false,"error":"unauthorized access"}', { status: 401 })),
    );

    await expect(pipedrivePerson.send(lead)).resolves.toEqual({
      ok: false,
      error: `POST ${PERSONS_URL} failed: HTTP 401`,
    });
  });

  it("повертає помилку, якщо Pipedrive відповів success: false зі статусом 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"success":false,"data":{"id":0}}', { status: 200 })),
    );

    await expect(pipedrivePerson.send(lead)).resolves.toEqual({
      ok: false,
      error: "pipedrive error: person not created",
    });
  });
});
