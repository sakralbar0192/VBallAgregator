import type { WizardContext } from 'telegraf/scenes';
import type { StepDefinition, StepFactoryConfig } from './step-wizard-types.js';

export class StepFactory<
  StepType extends string,
  ActionType extends string,
  ContextType extends WizardContext,
> {
  private steps: Map<string, StepDefinition<StepType, ActionType, ContextType>>;
  private currentStep: StepType | null;
  defaultStep: StepType;
  finalizeFunction: (ctx: ContextType) => Promise<void>;

  constructor(config: StepFactoryConfig<StepType, ActionType, ContextType>) {
    this.steps = new Map();
    this.defaultStep = config.defaultStep;
    this.finalizeFunction = config.finalizeFunction;
    this.currentStep = null;
    config.steps.forEach(step => {
      this.steps.set(step.name, step);
    });
  }

  async execute(ctx: ContextType, stepName: StepType): Promise<void> {
    const step = this.steps.get(stepName);
    if (!step) throw new Error(`Step ${stepName} not found`);
    this.currentStep = step.name;
    await step.step.execute(ctx);
  }

  /** Вернуться к предыдущему шагу мастера (по порядку регистрации шагов). */
  async goBack(ctx: ContextType): Promise<'rewound' | 'at-first'> {
    const ordered = Array.from(this.steps.keys()) as StepType[];
    const cur = this.currentStep;
    if (!cur) {
      await this.execute(ctx, this.defaultStep);
      return 'rewound';
    }
    const idx = ordered.indexOf(cur);
    if (idx <= 0) return 'at-first';
    const prev = ordered[idx - 1] as StepType;
    const curDef = cur ? this.steps.get(cur) : undefined;
    curDef?.beforeRewindToPrevious?.(ctx);
    await this.execute(ctx, prev);
    return 'rewound';
  }

  async handle(ctx: ContextType, action: ActionType): Promise<StepType | null> {
    const stepName = this.getStepNameByAction(action);
    if (!stepName) return null;
    const step = this.steps.get(stepName);
    if (!step) return null;
    const shouldProceed = await step.step.handleInput(ctx, action);
    if (shouldProceed) {
      const nextStep = this.getNextStep(stepName);
      return nextStep ? nextStep : null;
    }
    return stepName as StepType;
  }

  private getStepNameByAction(action: string): string | undefined {
    for (const [, value] of this.steps) {
      if (action.startsWith(`${value.name}_`)) {
        return value.name;
      }
    }
    return undefined;
  }

  private getNextStep(currentStep: string): StepType | null {
    const steps = Array.from(this.steps.keys());
    const currentIndex = steps.indexOf(currentStep);
    return (steps[currentIndex + 1] as StepType) || null;
  }
}
