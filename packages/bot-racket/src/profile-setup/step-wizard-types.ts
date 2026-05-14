import type { WizardContext } from 'telegraf/scenes';

export type StepDefinition<N extends string, A extends string, C extends WizardContext> = {
  name: N;
  step: {
    execute(ctx: C): Promise<void>;
    handleInput(ctx: C, action: A): Promise<boolean | void>;
  };
};

export type StepFactoryConfig<N extends string, A extends string, C extends WizardContext> = {
  steps: StepDefinition<N, A, C>[];
  defaultStep: N;
  finalizeFunction: (ctx: C) => Promise<void>;
};

export interface EntityInfo {
  name: string;
  shortName: string;
}
