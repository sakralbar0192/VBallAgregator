// Абстрактный базовый класс для доменных ошибок
export abstract class AbstractDomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context: Record<string, any> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
  }

  abstract getUserMessage(): string;
  abstract isRetryable(): boolean;
}