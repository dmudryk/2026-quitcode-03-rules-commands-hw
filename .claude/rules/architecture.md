---
paths:
  - "app/src/**/*.ts"
---

# Архітектура lead-sync

## Контекст

`lead-sync` — воркер, перенесений з n8n: розсилає нові ліди в зовнішні системи.
Код поділений на три шари з одним дозволеним напрямом залежностей; ядро спільне
для всіх клієнтських воркерів агенції, тому його API фіксований
(`materials/architecture-brief.md`, розділи «Шари і напрям залежностей» та «Ядро»).

## Правило

- Шари й напрям залежностей: `app/src/integrations/**` і `app/src/sync/**`
  імпортують з `app/src/core/**`. `core/` не імпортує нічого з решти проєкту.
- `integrations/` нічого не знають про `sync/`. `sync/` працює з інтеграціями лише
  через контракт `Integration` з `core/types.ts` і реєстр `integrations/index.ts` —
  не через прямий імпорт конкретного модуля інтеграції.
- Нова зовнішня система — це рівно три зміни, більше нічого:
  1. `app/src/integrations/<kebab-name>.ts`;
  2. тест поруч — `app/src/integrations/<kebab-name>.test.ts`;
  3. один рядок у `app/src/integrations/index.ts`.
- Модуль інтеграції експортує об'єкт типу `Integration`: `name` (kebab-case, збігається
  з іменем файлу), `requiredEnv` (лише імена змінних середовища, не значення),
  `send(lead)` → `Promise<Result<void>>`.
- Публічний API ядра — рівно ось це. Іншого не існує, і вигадувати його не можна:

  | Модуль | Експорт |
  |---|---|
  | `core/types.ts` | `Lead`, `Result<T>`, `Integration` |
  | `core/http.ts` | `postJson(url, body, options?)`, `PostOptions` |
  | `core/config.ts` | `readEnv(name)` |
  | `core/parse.ts` | `parseJson(text, guard, label?)`, `Guard<T>`, `isRecord`, `isString`, `isNumber` |
  | `core/log.ts` | `log.info`, `log.warn`, `log.error`, `redact(text)` |

- Потрібного експорту в ядрі немає — не додавай його до ядра і не обходь ядро
  власною реалізацією поза ним. Зупинись і опиши потрібну зміну (див. правило
  `do-not-touch`).
- Взірець «як правильно» для нової інтеграції — `app/src/integrations/slack-notify.ts`.

## Як перевірити

- `cd app && npm run check:rules` → `0` у рядку `core-untouched`.
- `cd app && npm run typecheck` → чисто; імпорт експорту, якого в ядрі немає, впаде тут.
- Нова інтеграція: `git status --short` показує рівно два нових файли
  (`<kebab-name>.ts`, `<kebab-name>.test.ts`) і зміну в `integrations/index.ts`.
- `grep -rn "from \"../sync" app/src/integrations/` → нічого.
