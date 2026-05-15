# Чек-лист ручной регрессии VBallAgregator (сводный)

> **Назначение:** быстрый проход по зонам с отметками **Pass/Fail/Blocked**. Детальные шаги и тест-данные — в [`regression-test-cases.md`](regression-test-cases.md) (версия 2.0).

**Версия:** 2.1  
**Дата:** 2026-05-15

---

## Подготовка

| # | Проверка | ✓ |
|---|----------|---|
| P1 | Стенд: бот, БД, Redis, **отдельный процесс `scheduler-service`** (BullMQ workers), при микросервисном сценарии — RabbitMQ + outbox-publisher + notification-worker; `INTERNAL_API_TOKEN` задан для `/internal/*` | |
| P2 | Два Telegram-аккаунта (игрок + организатор) | |
| P3 | Известны URL API для `/health*` и при необходимости `/internal/*` (S2S Bearer) | |
| P4 | Rate limit не отключён (кроме явного теста TC-INF-005) | |

---

## P0 — дымовой минимум (обязательно перед релизом)

| ID | Кейс | Автотест | Результат |
|----|------|----------|-----------|
| TC-REG-001 | Новый пользователь: `/start` → мультивыбор видов → пол/возраст один раз → волейбол и/или теннис → финал (Organizer только при флаге в конце) | e2e `newUser_volleyballOnly`, `newUser_tennisOnly` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-REG-002 | Организатор: завершённый онбординг с флагом «организую волейбол» → запись `Organizer` | e2e `volleyball_organizer_noOthers`; integration demographics | ☐ Pass ☐ Fail ☐ Blocked |
| TC-REG-003 | Пользователь со всеми видами из каталога: `/start` → выбор «изменить волейбол / теннис» (один вид за раз) | e2e `returning_editVolleyball` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-REG-004 | Частичный набор видов: `/start` → «редактировать» или «добавить вид» | e2e `partial_addTennis` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-TENNIS-001 | Теннис: полный wizard `tennis-profile` → `matching_profiles` + `matching_schedules` с `sport=tennis` + строка `user_sport_profiles` | e2e `newUser_tennisOnly`; integration `racket-profile-wizard-finalize` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-VB-ORG-001 | Волейбол: шаг организаторов при **пустом** списке других организаторов — сразу summary, без списка | e2e `volleyball_organizer_noOthers` | ☐ Pass ☐ Fail ☐ Blocked |
| — | `/start` во время теннис-мастера не ломает сессию | e2e `start_clearsTennisScene` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-PLAYER-001 | `/games` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-PLAYER-003 | `/join` → confirmed | ☐ Pass ☐ Fail ☐ Blocked |
| TC-PLAYER-007 | `/leave` + промоушен waitlist (если подготовлены данные) | ☐ Pass ☐ Fail ☐ Blocked |
| TC-PLAYER-010 | `/my` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-PLAYER-013 | `/pay` после `startsAt` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-ORGANIZER-001 | `/newgame` полный мастер | ☐ Pass ☐ Fail ☐ Blocked |
| TC-ORGANIZER-003 | `/close` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-ORGANIZER-006 | `/payments` | ☐ Pass ☐ Fail ☐ Blocked |
| TC-INF-001 | `GET /health` | ☐ Pass ☐ Fail ☐ Blocked |

---

## P1 — полная регрессия (бот)

### Регистрация (TC-REG-007 … 010)

| ID | Кратко | Результат |
|----|--------|-----------|
| TC-REG-007 | Повторный `/start`, дубликатов нет | ☐ |
| TC-REG-008 | Все уровни волейбольного мастера | ☐ |
| TC-REG-009 | Выбор организаторов + пустой выбор | ☐ |
| TC-REG-010 | Прерывание без `/cancel` (фактическое поведение) | ☐ |

### Игрок (TC-PLAYER-002,004–009,011–012,014)

| ID | Кратко | Результат |
|----|--------|-----------|
| TC-PLAYER-002 | `/game <uuid>` | ☐ |
| TC-PLAYER-004 | `join_game_*` | ☐ |
| TC-PLAYER-005 | Waitlist | ☐ |
| TC-PLAYER-006 | Двойной join | ☐ |
| TC-PLAYER-008 | Leave из waitlist | ☐ |
| TC-PLAYER-009 | `leave_game_*` | ☐ |
| TC-PLAYER-011 | `/myorganizers` | ☐ |
| TC-PLAYER-012 | `/pay` до начала — запрет | ☐ |
| TC-PLAYER-014 | Повторный `/pay` | ☐ |

### Настройки (TC-SETTINGS-001 … 005)

| ID | Результат |
|----|-----------|
| TC-SETTINGS-001 | ☐ |
| TC-SETTINGS-002 | ☐ |
| TC-SETTINGS-003 | ☐ |
| TC-SETTINGS-004 | ☐ |
| TC-SETTINGS-005 | ☐ |

### Приглашения (TC-INV-001 … 003)

| ID | Результат |
|----|-----------|
| TC-INV-001 | ☐ |
| TC-INV-002 | ☐ |
| TC-INV-003 | ☐ |

### Общие (TC-COMMON-001 … 003)

| ID | Результат |
|----|-----------|
| TC-COMMON-001 | ☐ |
| TC-COMMON-002 | ☐ |
| TC-COMMON-003 | ☐ |

### Организатор (остальные TC-ORGANIZER-*)

| ID | Кратко | Результат |
|----|--------|-----------|
| TC-ORGANIZER-002 | Прерывание мастера | ☐ |
| TC-ORGANIZER-004 | «Открытие» записи — N/A если нет команды | ☐ |
| TC-ORGANIZER-005 | `close_game_*` | ☐ |
| TC-ORGANIZER-007 | `payments_game_*` | ☐ |
| TC-ORGANIZER-008 | `remind_payments_*` | ☐ |
| TC-ORGANIZER-009 | `/pendingplayers` + confirm | ☐ |
| TC-ORGANIZER-010 | `reject_player_*` | ☐ |
| TC-ORGANIZER-011 | `/myplayers` | ☐ |
| TC-ORGANIZER-012 | `/my` организатор | ☐ |

### Платежи и время на стенде (TC-PAY-001 … 005)

| ID | Результат |
|----|-----------|
| TC-PAY-001 | ☐ |
| TC-PAY-002 | ☐ |
| TC-PAY-003 | ☐ |
| TC-PAY-004 | ☐ |
| TC-PAY-005 | ☐ |

### Инфра и негатив P1 (TC-INF-002 … 004, TC-NEG-003 … 005)

| ID | Результат |
|----|-----------|
| TC-INF-002 | ☐ |
| TC-INF-003 | ☐ |
| TC-INF-004 | ☐ |
| TC-NEG-003 | ☐ |
| TC-NEG-004 | ☐ |
| TC-NEG-005 | ☐ |

---

## P2 — расширенная регрессия

| Группа | ID | Результат |
|--------|-----|-----------|
| Платежи | TC-PAY-006 | ☐ |
| Инфра | TC-INF-005, TC-INF-006 | ☐ |
| Негатив | TC-NEG-001,002,006–010 | ☐ |
| Общее | TC-COMMON-003 | ☐ (если не в P1) |

---

## Итог прогона

| Метрика | Значение |
|---------|----------|
| Дата | |
| Окружение | |
| P0: Pass / Total | / 15 |
| P1: Pass / Total | / |
| P2: Pass / Total | / |
| Заблокировано (Blocked) | список ID: |

**Рекомендация:** ☐ готово к релизу ☐ доработки по критичным дефектам

**Подпись:** _______________
