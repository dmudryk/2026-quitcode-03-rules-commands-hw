#!/usr/bin/env node
// PreToolUse hook: забороняє запис у захищені зони проєкту (правило do-not-touch).
//
// Читає JSON події зі stdin, бере шлях із tool_input.file_path і, якщо він веде в
// захищену зону, пише причину в stderr і завершується з кодом 2 — Claude Code
// скасовує дію й показує цей текст агенту.
//
// Node, а не bash: так хук працює і на Windows.
// Виходи: 0 — дозволено, 2 — заблоковано.

const PROTECTED = [
  "app/src/core/",
  "app/scripts/",
  "materials/",
  ".github/",
  ".coderabbit.yaml",
];

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

// Windows дає шляхи з "\" і довільним регістром диска — зводимо до одного вигляду.
const normalize = (path) => path.replace(/\\/g, "/").toLowerCase();

const raw = await readStdin();

let event;
try {
  event = JSON.parse(raw);
} catch {
  // Невідомий формат події — не блокуємо роботу, але лишаємо слід у stderr.
  console.error("protect-core: не вдалося розібрати JSON події хука");
  process.exit(0);
}

const filePath = event?.tool_input?.file_path ?? event?.tool_input?.path ?? "";
if (!filePath) process.exit(0);

const normalized = normalize(filePath);
const hit = PROTECTED.find((zone) => normalized.includes(`/${normalize(zone)}`) || normalized.startsWith(normalize(zone)));

if (!hit) process.exit(0);

console.error(
  [
    `ЗАБЛОКОВАНО: ${filePath}`,
    `Шлях у захищеній зоні "${hit}" — правило .claude/rules/do-not-touch.md.`,
    "Це не помилка інструмента: у звичайних задачах ця зона не редагується взагалі.",
    "Зупинись і опиши людині: що саме треба змінити (файл, експорт, рядок), навіщо,",
    "який мінімальний вигляд має зміна і що можна зробити поза захищеною зоною.",
  ].join("\n"),
);
process.exit(2);
