/**
 * Общий каркас для пошаговых wizard в Telegram (волейбол + ракетка).
 * Постепенно переносить сюда повторяющиеся типы из `bot-volley` / `bot-racket`.
 */
export type WizardStepId = string;

export interface WizardSessionState {
  stepId: WizardStepId;
  updatedAtIso: string;
}
