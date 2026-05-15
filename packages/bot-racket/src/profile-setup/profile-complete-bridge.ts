import type { ProfileSetupWizardContext } from './types.js';

type TennisCompleteCtx = ProfileSetupWizardContext;

let tennisProfileSavedHandler: ((ctx: TennisCompleteCtx) => Promise<void>) | null = null;

export function setTennisProfileSavedHandler(handler: (ctx: TennisCompleteCtx) => Promise<void>): void {
  tennisProfileSavedHandler = handler;
}

export async function invokeTennisProfileSaved(ctx: TennisCompleteCtx): Promise<void> {
  await tennisProfileSavedHandler?.(ctx);
}
