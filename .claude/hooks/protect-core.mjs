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

// Windows дає шляхи з "\" і довільним регістром — зводимо до одного вигляду.
const normalize = (path) => path.replace(/\\/g, "/").toLowerCase();

// Яка із захищених зон зачеплена, якщо взагалі зачеплена.
// loose = true — для сирого тексту події, де шлях не обов'язково стоїть на межі
// сегмента; там краще перестрахуватись і заблокувати, ніж пропустити.
const findZone = (text, loose = false) => {
  const normalized = normalize(text);
  return PROTECTED.find((zone) => {
    const needle = normalize(zone);
    if (loose) return normalized.includes(needle);
    return normalized.startsWith(needle) || normalized.includes(`/${needle}`);
  });
};

const block = (zone, what, note) => {
  console.error(
    [
      `ЗАБЛОКОВАНО: ${what}`,
      `Шлях у захищеній зоні "${zone}" — правило .claude/rules/do-not-touch.md.`,
      ...(note ? [note] : []),
      "Це не помилка інструмента: у звичайних задачах ця зона не редагується взагалі.",
      "Зупинись і опиши людині: що саме треба змінити (файл, експорт, рядок), навіщо,",
      "який мінімальний вигляд має зміна і що можна зробити поза захищеною зоною.",
    ].join("\n"),
  );
  process.exit(2);
};

const raw = await readStdin();

let event;
try {
  event = JSON.parse(raw);
} catch {
  // Формат події невідомий. Тихо пропустити тут — значить лишити дірку в захисті,
  // тому шукаємо захищену зону прямо в сирому тексті події: якщо вона там згадана,
  // блокуємо. Якщо ні — не заважаємо роботі.
  const zone = findZone(raw, true);
  if (zone) block(zone, "подія хука зі згадкою захищеної зони", "JSON події не розібрався, тому шлях узято з сирого тексту.");
  console.error("protect-core: не вдалося розібрати JSON події хука");
  process.exit(0);
}

const filePath = event?.tool_input?.file_path ?? event?.tool_input?.path ?? "";
if (!filePath) process.exit(0);

const zone = findZone(filePath);
if (!zone) process.exit(0);

block(zone, filePath);
