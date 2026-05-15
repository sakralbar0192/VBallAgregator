import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createBot } from '../../../../bot-volley/src/bot/create-bot.js';
import { prisma } from '../../infrastructure/prisma.js';
import { sessionManager } from '../../shared/session-manager.js';
import { GameCreationWizard } from '../../../../bot-volley/src/bot/game-creation-wizard.js';
import { CommandHandlers } from '../../../../bot-volley/src/bot/command-handlers.js';
import { OnbCallback } from '../../../../bot-volley/src/bot/registration/onboarding-callbacks.js';
import { demoAgeCallback } from '../../../../bot-volley/src/bot/registration/onboarding-callbacks.js';
import { vbLevelCallback, vbWeekDayCallback, vbTimeCallback, vbTimeDoneCallback } from '../../../../bot-volley/src/bot/registration/onboarding-callbacks.js';
import { OnbText } from '../../../../bot-volley/src/bot/registration/onboarding-text.js';
import { TennisText } from '../../../../bot-racket/src/profile-setup/tennis-text.js';
import { clearDatabase } from '../test-db-helpers.js';
import {
  patchTelegramApiClient,
  buildPrivateMessageUpdate,
  buildCallbackUpdate,
  resetTelegramHarnessSeq,
  findLastMessageWithText,
  getLastMessageIdForChat,
  drainCallbacks,
  type ApiCallRecord,
} from './telegram-harness.js';

const NEW_VB_TG = 940_001;
const NEW_TN_TG = 940_002;
const PARTIAL_TG = 940_003;
const EDIT_VB_TG = 940_004;
const ORG_EMPTY_TG = 940_005;
const START_SCENE_TG = 940_006;

function runCallback(
  bot: Awaited<ReturnType<typeof createBot>>,
  uid: { n: number },
  chatId: number,
  outgoing: { calls: ApiCallRecord[] },
  data: string,
): Promise<void> {
  const messageId = getLastMessageIdForChat(outgoing.calls, chatId);
  return bot.handleUpdate(
    buildCallbackUpdate({
      updateId: uid.n++,
      chatId,
      userId: chatId,
      messageId,
      data,
    }),
  );
}

describe('e2e onboarding flows', () => {
  const outgoing: { calls: ApiCallRecord[] } = { calls: [] };
  let bot: Awaited<ReturnType<typeof createBot>>;
  let uid = { n: 1 };
  let unpatchApi: (() => void) | undefined;

  beforeEach(async () => {
    resetTelegramHarnessSeq();
    outgoing.calls = [];
    uid = { n: 1 };
    unpatchApi = patchTelegramApiClient(outgoing);
    sessionManager.terminate();
    GameCreationWizard.resetSessionsForTests();
    CommandHandlers.resetOrganizerSessionsForTests();
    await clearDatabase();
    bot = await createBot({ skipRateLimit: true });
  });

  afterEach(async () => {
    unpatchApi?.();
    unpatchApi = undefined;
    await clearDatabase();
  });

  it('newUser_volleyballOnly: /start through volleyball wizard to summary', async () => {
    const chatId = NEW_VB_TG;
    await bot.handleUpdate(
      buildPrivateMessageUpdate({ updateId: uid.n++, chatId, userId: chatId, text: '/start' }),
    );
    expect(findLastMessageWithText(outgoing.calls, OnbText.startNewUser.slice(0, 20))).toBeDefined();

    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportToggleVolleyball);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportDone);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.demoGenderMen);
    await runCallback(bot, uid, chatId, outgoing, demoAgeCallback('after-thirty'));
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.vbFormatClassic);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.vbFormatDone);
    await runCallback(bot, uid, chatId, outgoing, vbLevelCallback('novice'));
    await runCallback(bot, uid, chatId, outgoing, vbWeekDayCallback('monday'));
    await runCallback(bot, uid, chatId, outgoing, vbWeekDayCallback('done'));
    await runCallback(bot, uid, chatId, outgoing, vbTimeCallback('monday', 'ten-am'));
    await runCallback(bot, uid, chatId, outgoing, vbTimeDoneCallback('monday'));
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.vbOrgNo);

    expect(findLastMessageWithText(outgoing.calls, 'Профиль волейбола настроен')).toBeDefined();

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(chatId) } });
    expect(user?.activeSport).toBe('volleyball');
    const sp = await prisma.userSportProfile.findUnique({
      where: { userId_sport: { userId: user!.id, sport: 'volleyball' } },
    });
    expect(sp?.volleyballSkillTag).toBe('novice');
    const sched = await prisma.matchingSchedule.findUnique({
      where: { userId_sport: { userId: user!.id, sport: 'volleyball' } },
    });
    expect(sched?.monday).toBe('ten-am');
  });

  it('newUser_tennisOnly: simplified tennis wizard happy path', async () => {
    const chatId = NEW_TN_TG;
    await bot.handleUpdate(
      buildPrivateMessageUpdate({ updateId: uid.n++, chatId, userId: chatId, text: '/start' }),
    );
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportToggleTennis);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportDone);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.demoGenderWomen);
    await runCallback(bot, uid, chatId, outgoing, demoAgeCallback('before-twenty'));

    await drainCallbacks(bot, [
      buildCallbackUpdate({
        updateId: uid.n++,
        chatId,
        userId: chatId,
        messageId: getLastMessageIdForChat(outgoing.calls, chatId),
        data: 'play-level_beginner',
      }),
      buildCallbackUpdate({
        updateId: uid.n++,
        chatId,
        userId: chatId,
        messageId: getLastMessageIdForChat(outgoing.calls, chatId),
        data: 'preferred-gender_women',
      }),
      buildCallbackUpdate({
        updateId: uid.n++,
        chatId,
        userId: chatId,
        messageId: getLastMessageIdForChat(outgoing.calls, chatId),
        data: 'preferred-gender_done',
      }),
      buildCallbackUpdate({
        updateId: uid.n++,
        chatId,
        userId: chatId,
        messageId: getLastMessageIdForChat(outgoing.calls, chatId),
        data: 'preferred-age_before-twenty',
      }),
      buildCallbackUpdate({
        updateId: uid.n++,
        chatId,
        userId: chatId,
        messageId: getLastMessageIdForChat(outgoing.calls, chatId),
        data: 'preferred-age_done',
      }),
      buildCallbackUpdate({
        updateId: uid.n++,
        chatId,
        userId: chatId,
        messageId: getLastMessageIdForChat(outgoing.calls, chatId),
        data: 'week-day_monday',
      }),
      buildCallbackUpdate({
        updateId: uid.n++,
        chatId,
        userId: chatId,
        messageId: getLastMessageIdForChat(outgoing.calls, chatId),
        data: 'week-day_done',
      }),
      buildCallbackUpdate({
        updateId: uid.n++,
        chatId,
        userId: chatId,
        messageId: getLastMessageIdForChat(outgoing.calls, chatId),
        data: 'day-time_ten-am',
      }),
      buildCallbackUpdate({
        updateId: uid.n++,
        chatId,
        userId: chatId,
        messageId: getLastMessageIdForChat(outgoing.calls, chatId),
        data: 'day-time_done',
      }),
    ]);

    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(chatId) } });
    const profile = await prisma.matchingProfile.findUnique({
      where: { userId_sport: { userId: user!.id, sport: 'tennis' } },
    });
    expect(profile?.playLevelCode).toBe('beginner');
    expect(findLastMessageWithText(outgoing.calls, TennisText.savedStandalone.slice(0, 15) || 'теннис')).toBeDefined();
  });

  it('partial_addTennis: volleyball user adds tennis via partial add', async () => {
    const chatId = PARTIAL_TG;
    const existing = await prisma.user.create({
      data: {
        telegramId: BigInt(chatId),
        name: 'Partial',
        gender: 'men',
        ageBand: 'after-thirty',
        activeSport: 'volleyball',
        levelTag: 'novice',
      },
    });
    await prisma.userSportProfile.create({
      data: {
        userId: existing.id,
        sport: 'volleyball',
        volleyballSkillTag: 'novice',
        volleyballFormats: 'classic',
      },
    });

    await bot.handleUpdate(
      buildPrivateMessageUpdate({ updateId: uid.n++, chatId, userId: chatId, text: '/start' }),
    );
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.partialAdd);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportToggleTennis);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportDone);

    expect(findLastMessageWithText(outgoing.calls, OnbText.tennisSetup.slice(0, 15))).toBeDefined();
  });

  it('returning_editVolleyball: loads edit flow for existing volleyball profile', async () => {
    const chatId = EDIT_VB_TG;
    const user = await prisma.user.create({
      data: {
        telegramId: BigInt(chatId),
        name: 'Editor',
        gender: 'men',
        ageBand: 'after-thirty',
        activeSport: 'volleyball',
      },
    });
    await prisma.userSportProfile.create({
      data: {
        userId: user.id,
        sport: 'volleyball',
        volleyballSkillTag: 'amateur',
        volleyballFormats: 'classic',
      },
    });
    await prisma.matchingSchedule.create({
      data: { userId: user.id, sport: 'volleyball', monday: 'ten-am' },
    });

    await bot.handleUpdate(
      buildPrivateMessageUpdate({ updateId: uid.n++, chatId, userId: chatId, text: '/start' }),
    );
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.partialEdit);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.returningEditVolleyball);

    expect(findLastMessageWithText(outgoing.calls, OnbText.vbFormatsEdit.slice(0, 20))).toBeDefined();
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.vbFormatBeach);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.vbFormatDone);
    await runCallback(bot, uid, chatId, outgoing, vbLevelCallback('pro'));
    await runCallback(bot, uid, chatId, outgoing, vbWeekDayCallback('done'));
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.vbOrgNo);

    const sp = await prisma.userSportProfile.findUnique({
      where: { userId_sport: { userId: user.id, sport: 'volleyball' } },
    });
    expect(sp?.volleyballFormats).toContain('beach');
    expect(sp?.volleyballSkillTag).toBe('pro');
  });

  it('volleyball_organizer_noOthers: skips organizer list when DB has no other organizers', async () => {
    const chatId = ORG_EMPTY_TG;
    await bot.handleUpdate(
      buildPrivateMessageUpdate({ updateId: uid.n++, chatId, userId: chatId, text: '/start' }),
    );
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportToggleVolleyball);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportDone);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.demoGenderMen);
    await runCallback(bot, uid, chatId, outgoing, demoAgeCallback('after-thirty'));
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.vbFormatClassic);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.vbFormatDone);
    await runCallback(bot, uid, chatId, outgoing, vbLevelCallback('novice'));
    await runCallback(bot, uid, chatId, outgoing, vbWeekDayCallback('tuesday'));
    await runCallback(bot, uid, chatId, outgoing, vbWeekDayCallback('done'));
    await runCallback(bot, uid, chatId, outgoing, vbTimeCallback('tuesday', 'nine-am'));
    await runCallback(bot, uid, chatId, outgoing, vbTimeDoneCallback('tuesday'));
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.vbOrgYes);

    expect(findLastMessageWithText(outgoing.calls, 'Профиль волейбола настроен')).toBeDefined();
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(chatId) } });
    const sp = await prisma.userSportProfile.findUnique({
      where: { userId_sport: { userId: user!.id, sport: 'volleyball' } },
    });
    expect(sp?.wantsOrganizeVolleyball).toBe(true);
    const org = await prisma.organizer.findUnique({ where: { userId: user!.id } });
    expect(org).not.toBeNull();
  });

  it('start_clearsTennisScene: /start during tennis wizard does not throw', async () => {
    const chatId = START_SCENE_TG;
    await bot.handleUpdate(
      buildPrivateMessageUpdate({ updateId: uid.n++, chatId, userId: chatId, text: '/start' }),
    );
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportToggleTennis);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.sportDone);
    await runCallback(bot, uid, chatId, outgoing, OnbCallback.demoGenderMen);
    await runCallback(bot, uid, chatId, outgoing, demoAgeCallback('after-thirty'));
    await runCallback(bot, uid, chatId, outgoing, 'play-level_beginner');

    await bot.handleUpdate(
      buildPrivateMessageUpdate({ updateId: uid.n++, chatId, userId: chatId, text: '/start' }),
    );
    expect(findLastMessageWithText(outgoing.calls, OnbText.startNewUser.slice(0, 15))).toBeDefined();
  });
});
