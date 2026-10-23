# BARI — личное приложение Айданы

Отдельное веб-приложение (PWA): ставится на главный экран телефона, работает без Claude, данные синхронизируются между телефоном и компьютером.

## Из чего состоит
- `index.html` — само приложение (план дня, неделя, ритм, вкладка «Я», BARI).
- `config.js` — адрес базы Supabase и публичный ключ.
- `supabase.sql` — создаёт таблицу для данных (запустить один раз).
- `seed.json` — текущие задачи и настройки, переносятся при первом входе.
- `content/lessons/ГГГГ-ММ-ДД.json` — урок дня; `content/digest/ГГГГ-ММ-ДД.json` — сводка новостей. Их каждое утро публикует Claude.
- `manifest.webmanifest`, `sw.js`, `icons/` — установка на телефон и работа без интернета.

## Запуск
1. Supabase → New project → SQL Editor → вставить `supabase.sql` → Run.
2. Authentication → Providers → Email: включено. Для удобства можно выключить «Confirm email».
3. Project Settings → API: скопировать Project URL и anon public key в `config.js`.
4. Опубликовать папку на GitHub Pages (Settings → Pages → Deploy from branch → main / root).
5. Открыть адрес на телефоне → «Поделиться» → «На экран Домой».
