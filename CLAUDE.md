# CLAUDE.md

Спільна база проєкту — імпортується (не просто згадується посиланням):

@AGENTS.md

## Специфічне для Claude Code

- Правила проєкту живуть у `.claude/rules/`:
  - `do-not-touch.md` — без `paths`, завантажується в кожній сесії;
  - `architecture.md` і `conventions.md` — з `paths: ["app/src/**/*.ts"]`, підтягуються
    при роботі з кодом застосунку.
- Команди — у `.claude/commands/`: `/analyze-error`, `/refactor`, `/generate-integration`.
  Ціль передається аргументом після назви команди.
- Хук `PreToolUse` у `.claude/settings.json` блокує `Edit`/`Write` у `app/src/core/**`
  (скрипт `.claude/hooks/protect-core.mjs`, вихід з кодом 2). Якщо дію заблоковано —
  це очікувана поведінка, а не помилка: зупинись і опиши потрібну зміну людині.
- Термінал — Windows PowerShell. Шляхи в командах пиши через `/`, для запуску з кореня
  репозиторію використовуй `npm --prefix app <script>`.
