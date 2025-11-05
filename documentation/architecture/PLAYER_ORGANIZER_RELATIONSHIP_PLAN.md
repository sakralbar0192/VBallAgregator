# План реализации логики "Своих игроков" для организаторов

## Контекст
Система должна позволить игрокам выбирать организаторов, организаторам подтверждать игроков, и обеспечить приоритетный доступ подтвержденных игроков к новым играм с двухчасовым окном для ответа.

---

## Этап 1: Расширение схемы данных (Prisma)

### 1.1 Добавить таблицу `PlayerOrganizer` для связи M:N
```sql
model PlayerOrganizer {
  id            String   @id @default(uuid())
  playerId      String
  organizerId   String
  status        String   @default("pending")  // pending, confirmed, rejected
  requestedAt   DateTime @default(now())
  confirmedAt   DateTime?
  
  player        User     @relation("PlayerToOrganizers", fields: [playerId], references: [id], onDelete: Cascade)
  organizer     Organizer @relation("OrganizerToPlayers", fields: [organizerId], references: [id], onDelete: Cascade)
  
  @@unique([playerId, organizerId])
  @@index([organizerId, status])
  @@index([playerId, status])
  @@map("player_organizers")
}
```

### 1.2 Обновить модели `User` и `Organizer`
- `User`: добавить relation `playerOrganizers: PlayerOrganizer[]`
- `Organizer`: добавить relation `players: PlayerOrganizer[]`

### 1.3 Добавить таблицу `GamePlayerResponse` для отслеживания ответов
```sql
model GamePlayerResponse {
  id            String   @id @default(uuid())
  gameId        String
  playerId      String
  response      String   // "yes", "no", "ignored"
  respondedAt   DateTime?
  createdAt     DateTime @default(now())
  
  game          Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  player        User     @relation(fields: [playerId], references: [id], onDelete: Cascade)
  
  @@unique([gameId, playerId])
  @@index([gameId, response])
  @@map("game_player_responses")
}
```

### 1.4 Добавить поле в `Game`
- `priorityWindowClosesAt: DateTime?` — время закрытия приоритетного окна (startsAt - 2 часа)

---

## Этап 2: Создать use-cases для управления связями

### 2.1 `selectOrganizers(playerId, organizerIds[])`
- Проверить существование игрока и организаторов
- Создать записи `PlayerOrganizer` со статусом `pending`
- Опубликовать событие `PlayerSelectedOrganizers`

### 2.2 `confirmPlayer(organizerId, playerId)`
- Проверить существование связи со статусом `pending`
- Обновить статус на `confirmed`
- Опубликовать событие `PlayerConfirmedByOrganizer`

### 2.3 `rejectPlayer(organizerId, playerId)`
- Обновить статус на `rejected`
- Опубликовать событие `PlayerRejectedByOrganizer`

### 2.4 `getOrganizerPlayers(organizerId, status?)`
- Вернуть список игроков организатора с фильтром по статусу

---

## Этап 3: Расширить логику создания игры

### 3.1 Обновить `createGame()`
- После создания игры установить `priorityWindowClosesAt = startsAt - 2 часа`
- Опубликовать событие `GameCreatedWithPriorityWindow`

### 3.2 Создать `notifyConfirmedPlayersAboutGame(gameId)`
- Найти всех подтвержденных игроков организатора
- Отправить им уведомление с кнопками "Да", "Нет"
- Создать записи `GamePlayerResponse` со статусом `pending`

---

## Этап 4: Реализовать логику ответов и публикации

### 4.1 `respondToGameInvitation(gameId, playerId, response)`
- Проверить, что игрок — подтвержденный игрок организатора
- Обновить `GamePlayerResponse.response` и `respondedAt`
- Опубликовать событие `PlayerRespondedToGameInvitation`

### 4.2 Создать scheduler-задачу `checkPriorityWindowExpiration(gameId)`
- Запустить через 2 часа после создания игры
- Проверить статус ответов подтвержденных игроков
- Если все ответили или прошло 2 часа:
  - Обновить статус игры на `published_for_all`
  - Отправить уведомление остальным игрокам
  - Опубликовать событие `GamePublishedForAll`

### 4.3 Обновить `joinGame()`
- Если игра в приоритетном окне и игрок не подтвержден — отклонить с ошибкой
- Если игра опубликована для всех — разрешить присоединение

---

## Этап 5: Обновить систему уведомлений

### 5.1 Новые типы событий
- `PlayerSelectedOrganizers` → уведомить организаторов
- `PlayerConfirmedByOrganizer` → уведомить игрока
- `GameCreatedWithPriorityWindow` → отправить приоритетным игрокам
- `PlayerRespondedToGameInvitation` → логирование для организатора
- `GamePublishedForAll` → отправить остальным игрокам

### 5.2 Обновить `event-handlers.ts`
- Добавить обработчики для новых событий
- Интегрировать с `notification-service.ts`

---

## Этап 6: Обновить Telegram-команды

### 6.1 Новые команды для игроков
- `/selectorganizers` — выбрать организаторов
- `/myorganizers` — список моих организаторов
- `/respondtogame` — ответить на приглашение

### 6.2 Новые команды для организаторов
- `/my_players` — список подтвержденных игроков
- `/pendingplayers` — список ожидающих подтверждения
- `/confirmplayer` — подтвердить игрока
- `/rejectplayer` — отклонить игрока

---

## Этап 7: Тестирование

### 7.1 Unit-тесты
- Проверить создание связей `PlayerOrganizer`
- Проверить логику подтверждения
- Проверить логику ответов на приглашения

### 7.2 Integration-тесты
- Полный цикл: выбор → подтверждение → создание игры → ответ → публикация
- Проверить граничные случаи (истечение 2 часов, все ответили раньше)

### 7.3 E2E-тесты
- Сценарий с несколькими игроками и организаторами

---

## Таблица зависимостей

| Этап | Зависит от | Блокирует |
|------|-----------|----------|
| 1 | — | 2, 3, 4, 5 |
| 2 | 1 | 3, 4, 5 |
| 3 | 1, 2 | 4, 5 |
| 4 | 1, 2, 3 | 5, 6 |
| 5 | 1, 2, 3, 4 | 6 |
| 6 | 5 | 7 |
| 7 | 1–6 | — |

---

## Риски и смягчение

| Риск | Вероятность | Воздействие | Смягчение |
|------|-----------|-----------|----------|
| Scheduler не срабатывает в нужное время | Средняя | Высокое | Добавить fallback-проверку при запросе списка игр |
| Race condition при одновременных ответах | Низкая | Среднее | Использовать `@@unique` и транзакции |
| Игрок не получит уведомление | Средняя | Среднее | Добавить retry-логику в event-handlers |
| Организатор забудет подтвердить игроков | Высокая | Низкое | Отправлять напоминания через 24 часа |

---

## Оценка сложности

- **Схема данных**: 2–3 часа
- **Use-cases**: 4–5 часов
- **Scheduler-логика**: 3–4 часа
- **Уведомления**: 2–3 часа
- **Telegram-команды**: 3–4 часа
- **Тестирование**: 4–5 часов

**Итого**: ~20–25 часов разработки

---

## Приоритизация

1. **MVP (Неделя 1)**
   - Этап 1: Схема
   - Этап 2: Use-cases
   - Этап 3: Создание игры с приоритетным окном

2. **Phase 2 (Неделя 2)**
   - Этап 4: Логика ответов и публикации
   - Этап 5: Уведомления

3. **Phase 3 (Неделя 3)**
   - Этап 6: Telegram-команды
   - Этап 7: Тестирование
