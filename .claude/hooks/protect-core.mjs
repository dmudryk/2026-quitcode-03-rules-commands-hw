#!/usr/bin/env node
// PreToolUse hook: забороняє запис у захищені зони проєкту (правило do-not-touch).
//
// Читає JSON події зі stdin, дістає з неї всі шляхи, куди інструмент збирається
// писати, і якщо хоч один веде в захищену зону — пише причину в stderr і виходить
// з кодом 2. Claude Code скасовує дію й показує цей текст агенту.
//
// Node, а не bash: так хук працює і на Windows.
// Виходи: 0 — дозволено, 2 — заблоковано.
//
// Принцип: fail-closed. Якщо шлях визначити не вдалося — блокуємо. Хук стоїть лише
// на інструментах запису, тож «не знаю, куди пишуть» — недостатня підстава пускати.
// Гучна відмова краща за тихо знятий захист: у повідомленні видно, що сталося.
import { resolve } from "node:path";

const PROTECTED = [
  "app/src/core/",
  "app/scripts/",
  "materials/",
  ".github/",
  ".coderabbit.yaml",
];

const IS_WINDOWS = process.platform === "win32";

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
};

// Нормалізація — лише там, де вона правильна. На Windows "\" є роздільником, а
// регістр не має значення. На POSIX "\" — звичайний символ імені файлу, а регістр
// значущий: там шлях лишаємо як є, інакше файл `tmp\app/src/core/log.ts` (який до
// захищеної зони не належить) блокувався б помилково.
const flatten = (path) => (IS_WINDOWS ? path.replace(/\\/g, "/").toLowerCase() : path);

// resolve() робить шлях абсолютним і згортає "." та "..", тому
// "app/src/integrations/../core/types.ts" не прослизне повз перевірку рядків.
const canonical = (path) => flatten(resolve(path));

const findZone = (path) => {
  const normalized = canonical(path);
  return PROTECTED.find((zone) => normalized.includes(`/${flatten(zone)}`));
};

// Для сирого тексту події, який не вдалося розібрати: шукаємо згадку зони будь-де.
const findZoneInText = (text) => {
  const normalized = flatten(text);
  return PROTECTED.find((zone) => normalized.includes(flatten(zone)));
};

// Усі поля, якими інструменти запису передають ціль: Edit/Write — file_path,
// NotebookEdit — notebook_path, MultiEdit — ще й список правок.
const targetsOf = (input) => {
  const edits = Array.isArray(input?.edits) ? input.edits.map((edit) => edit?.file_path) : [];
  return [input?.file_path, input?.path, input?.notebook_path, ...edits].filter(
    (value) => typeof value === "string" && value.trim() !== "",
  );
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

const blockUnknown = (reason) => {
  console.error(
    [
      `ЗАБЛОКОВАНО: ${reason}`,
      "Хук не зміг визначити, куди веде запис, тому блокує дію — захист ядра не має",
      "залежати від того, чи впізнав він форму події.",
      "Якщо це помилкове спрацювання, перевір .claude/hooks/protect-core.mjs і формат",
      "події в каналі виводу Hooks — але не обходь захист.",
    ].join("\n"),
  );
  process.exit(2);
};

const raw = await readStdin();

let event;
try {
  event = JSON.parse(raw);
} catch {
  const zone = findZoneInText(raw);
  if (zone) block(zone, "подія хука зі згадкою захищеної зони", "JSON події не розібрався, шлях узято з сирого тексту.");
  blockUnknown("не вдалося розібрати JSON події хука");
}

const targets = targetsOf(event?.tool_input);
if (targets.length === 0) blockUnknown("у події немає шляху запису (file_path / path / notebook_path)");

for (const target of targets) {
  const zone = findZone(target);
  if (zone) block(zone, target);
}

process.exit(0);
