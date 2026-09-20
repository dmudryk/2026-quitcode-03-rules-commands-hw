# AGENTS.md — lead-sync

`lead-sync` — воркер клієнта Studio Nova, перенесений з n8n-воркфлоу. Кожні 5 хвилин
бере нові заявки з форми сайту й розсилає їх в інтеграції: Slack-канал менеджерів,
Google-таблицю, далі — CRM і месенджери. TypeScript, Node 22+, Vitest, **нуль
runtime-залежностей**. Джерело істини про архітектуру — `materials/architecture-brief.md`.

## Команди

Усі — з теки `app/` (або з кореня через `npm --prefix app ...`):

| Команда | Що робить |
|---|---|
| `npm install` | встановити залежності (лише dev) |
| `npm test` | Vitest, без реальної мережі — 21 тест |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check:rules` | статична перевірка конвенцій проєкту |

Поточна лінія: `check:rules` → `TOTAL: 1 violation(s)` — `json-via-parse` у
`src/sync/state.ts`, спадковий код, який переписують окремою задачею (він же корінна
причина інциденту з `materials/error-log.txt`). Нових порушень додавати не можна.

## Карта проєкту

```
app/src/core/          платформа: types, http, config, parse, log — ЗАХИЩЕНО, не редагувати
app/src/integrations/  по модулю на зовнішню систему + реєстр index.ts
app/src/sync/          запуск синхронізації і стан між запусками
app/scripts/           перевірка правил — ЗАХИЩЕНО
materials/             архітектурна записка, лог інциденту — ЗАХИЩЕНО
```

Напрям залежностей — лише `integrations/` і `sync/` → `core/`.

## Головні правила

1. `app/src/core/**`, `app/scripts/**`, `materials/**`, `.coderabbit.yaml`, `.github/**`
   не редагуються — без винятків. Потрібна зміна → зупинись і опиши її.
2. Помилки — значення: `Result<T>`, а не винятки. `send()` завжди повертає `Result<void>`.
3. HTTP — лише `postJson()`; змінні середовища — лише `readEnv()`; JSON — лише
   `parseJson(text, guard)`; журнал — лише `log`. Прямі `fetch`, `process.env`,
   `JSON.parse`, `console.*` заборонені.
4. Тихий фолбек на «значення за замовчуванням» замість помилки заборонений.
5. Без `any` (для невідомого — `unknown` + guard) і без нових залежностей.
6. У сповіщення не потрапляють `lead.email` і `lead.phone` — лише ім'я, джерело, бюджет.
7. Нова інтеграція — модуль + тест поруч + один рядок у `integrations/index.ts`.

Деталі, приклади й перевірки — у правилах проєкту: `.claude/rules/architecture.md`,
`.claude/rules/conventions.md`, `.claude/rules/do-not-touch.md`. Тут — лише короткий
перелік, правила не дублюються.

## Перед комітом

```bash
cd app && npm test && npm run typecheck && npm run check:rules
git diff --name-only -- app/src/core app/scripts materials .coderabbit.yaml .github   # має бути порожньо
```

`npm test` зелений, `typecheck` чистий, у `check:rules` немає нових порушень порівняно
з базовою лінією, захищені шляхи не змінені.
