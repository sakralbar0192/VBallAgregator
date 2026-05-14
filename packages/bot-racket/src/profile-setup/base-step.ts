import type { ProfileSetupWizardContext } from './types.js';

type ReplyMethod = 'editMessageText' | 'reply';

export abstract class BaseStep {
  abstract execute(ctx: ProfileSetupWizardContext): Promise<void>;
  abstract handleInput(
    ctx: ProfileSetupWizardContext,
    action: string,
  ): Promise<boolean | void>;

  isFirstStep = false;

  get replyMethod(): ReplyMethod {
    return this.isFirstStep ? 'reply' : 'editMessageText';
  }

  /** Отправка текста шага; игнорирует «message is not modified» при повторном edit с тем же содержимым. */
  protected async replyOrEdit(ctx: ProfileSetupWizardContext, text: string, extra?: object): Promise<void> {
    try {
      await ctx[this.replyMethod](text, extra as never);
    } catch (err: unknown) {
      if (BaseStep.isTelegramMessageNotModified(err)) return;
      throw err;
    }
  }

  private static isTelegramMessageNotModified(err: unknown): boolean {
    const desc =
      err &&
      typeof err === 'object' &&
      'response' in err &&
      err.response &&
      typeof err.response === 'object' &&
      'description' in err.response
        ? String((err.response as { description: string }).description)
        : '';
    return desc.includes('message is not modified');
  }

  /** Payload после `stepKey_` (корректно для `play-level_beginner`, `week-day_monday`, …). */
  protected stripActionPayload(action: string, stepKey: string): string {
    const p = `${stepKey}_`;
    return action.startsWith(p) ? action.slice(p.length) : '';
  }
}
