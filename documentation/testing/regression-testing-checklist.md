# Чек-лист ручной регрессии VBallAgregator (сводный)

> **Назначение:** быстрый проход по зонам с отметками **Pass/Fail/Blocked**. Детальные шаги и тест-данные — в [`regression-test-cases.md`](regression-test-cases.md) (версия 2.0).

**Версия:** 2.0  
**Дата:** 2026-05-11

---

## Подготовка

| # | Проверка | ✓ |
|---|----------|---|
| P1 | Стенд: бот, БД, Redis (для очередей/квот), воркер планировщика — по сценарию | |
| P2 | Два Telegram-аккаунта (игрок + организатор) | |
| P3 | Известны URL API для `/health*` | |
| P4 | Rate limit не отключён (кроме явного теста TC-INF-005) | |

---

## P0 — дымовой минимум (обязательно перед релизом)

| ID | Кейс | Результат |
|----|------|-----------|
| TC-REG-001 | Регистрация игрока (полный путь) | ☐ Pass ☐ Fail ☐ Blocked |
| TC-REG-002 | Регистрация организатора | ☐ Pass ☐ Fail ☐ Blocked |
| TC-RACKET-001 | Регистрация «ракетки»: полный wizard `racket-profile` → `matching_profiles` + `matching_schedules` в БД | ☐ Pass ☐ Fail ☐ Blocked |
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

### Регистрация (TC-REG-003 … 006)

| ID | Кратко | Результат |
|----|--------|-----------|
| TC-REG-003 | Повторный `/start`, дубликатов нет | ☐ |
| TC-REG-004 | Все уровни `level_*` | ☐ |
| TC-REG-005 | Выбор организаторов + пустой выбор | ☐ |
| TC-REG-006 | Прерывание без `/cancel` (фактическое поведение) | ☐ |

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
| P0: Pass / Total | / 11 |
| P1: Pass / Total | / |
| P2: Pass / Total | / |
| Заблокировано (Blocked) | список ID: |

**Рекомендация:** ☐ готово к релизу ☐ доработки по критичным дефектам

**Подпись:** _______________
