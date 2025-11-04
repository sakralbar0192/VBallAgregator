export class Counter {
  private count = 0;

  constructor(private name: string) {}

  increment(): void {
    this.count++;
  }

  getValue(): number {
    return this.count;
  }

  getName(): string {
    return this.name;
  }
}

export const metrics = {
  gamesCreated: new Counter('games_created'),
  registrationsProcessed: new Counter('registrations_processed'),
  notificationsSent: new Counter('notifications_sent'),
  notificationsFailed: new Counter('notifications_failed'),
  errorsHandled: new Counter('errors_handled'),
};