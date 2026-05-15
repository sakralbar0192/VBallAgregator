import type { Context } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/types';

function isMessageNotModified(err: unknown): boolean {
  const desc =
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'description' in err.response
      ? String((err.response as { description: string }).description)
      : '';
  return desc.toLowerCase().includes('message is not modified');
}

/** Есть ли сообщение с inline-клавиатурой, которое можно отредактировать (не inline-mode). */
export function hasEditableCallbackMessage(ctx: Context): boolean {
  const cq = ctx.callbackQuery;
  return Boolean(cq && 'message' in cq && cq.message && 'message_id' in cq.message && !cq.inline_message_id);
}

/**
 * Одна «панель» онбординга: при callback — правим то же сообщение, иначе отправляем новое.
 */
export async function editOrReplyInlinePanel(
  ctx: Context,
  text: string,
  replyMarkup?: InlineKeyboardMarkup,
): Promise<void> {
  const extra = replyMarkup ? { reply_markup: replyMarkup } : {};
  if (hasEditableCallbackMessage(ctx)) {
    try {
      await ctx.editMessageText(text, extra);
      return;
    } catch (e) {
      if (isMessageNotModified(e)) return;
      throw e;
    }
  }
  await ctx.reply(text, extra);
}

/** Короткое всплывающее уведомление; не падает, если callback уже закрыт. */
export async function toastCbQuery(ctx: Context, text: string, showAlert = false): Promise<void> {
  const id = ctx.callbackQuery?.id;
  if (!id) return;
  try {
    await ctx.telegram.answerCbQuery(id, text, { show_alert: showAlert });
  } catch {
    /* уже ответили или нет callback */
  }
}
