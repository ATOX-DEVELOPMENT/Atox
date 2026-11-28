# Правила репозитория Atox

## Ветки и релизы

- **`pre-release`** — рабочая ветка. Все PR (фиксы, фичи, рефакторинг) открываются в неё:
  `gh pr create --base pre-release`. Ветки от неё: `git switch -c <ветка> origin/pre-release`.
- **`main`** — релизная ветка. Напрямую в неё не коммитят и PR с фичами в неё не открывают.
  Перед релизом `pre-release` сливается в `main` одним PR `pre-release → main`, и этот мерж
  выпускает релиз.
- Релиз (`.github/workflows/release.yml`) запускается только push'ем в `main`
  (и ручным запуском, тоже только из `main`). Мержи в `pre-release` релиз не запускают.
  Не добавлять `pre-release` и другие ветки в триггеры релиза.
- Имена веток: `fix/<slug>`, `feat/<slug>`, `chore/<slug>` или `<N>-<slug>` (N — номер issue).
- `Closes #N` закрывает issue только при мерже в ветку по умолчанию, поэтому
  ветка по умолчанию на GitHub — `pre-release`.

## Сборка для разработчика

- `cd app && npm ci && npm run package:dev` собирает приложение из текущей ветки
  (обычно `pre-release`) с `ATOX_DEV_BUILD=1` в `app/dist/mac-arm64/Atox.app`
  (на Intel — `app/dist/mac/Atox.app`). Установить: закрыть Atox и скопировать бандл в
  `/Applications` (`rm -rf /Applications/Atox.app && cp -R app/dist/mac-arm64/Atox.app /Applications/`).
- Такая сборка **никогда не обновляется сама**: апдейтер не создаётся (ни проверок, ни загрузок,
  ни установки при выходе). В Settings → General и в About рядом с версией видно
  «Dev build (<ветка> @ <коммит>)». Чтобы получить изменения — пересобрать из `pre-release`.
- Обычные `npm run build` / `npm run package` и релиз в CI переменную не задают и обновляются как раньше.
