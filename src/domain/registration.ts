export enum RegStatus {
  confirmed = 'confirmed',
  waitlisted = 'waitlisted',
  canceled = 'canceled'
}

export enum PaymentStatus {
  unpaid = 'unpaid',
  paid = 'paid'
}

import { DomainError, ERROR_CODES } from './errors.js';
import type { Game } from './game.js';

export class Registration {
  constructor(
    readonly id: string,
    readonly gameId: string,
    readonly userId: string,
    public status: RegStatus,
    public paymentStatus: PaymentStatus = PaymentStatus.unpaid,
    public paymentMarkedAt?: Date,
    readonly createdAt: Date = new Date(),
  ) {}

  markPaid(game: Game) {
    if (!game.isPaymentWindowOpen) throw new DomainError(ERROR_CODES.PAYMENT_WINDOW_NOT_OPEN, 'Окно оплаты еще не открыто');
    if (this.status !== RegStatus.confirmed) throw new DomainError(ERROR_CODES.NOT_CONFIRMED, 'Только подтвержденные участники могут отмечать оплату');
    this.paymentStatus = PaymentStatus.paid;
    this.paymentMarkedAt = new Date();
  }

  cancel() { this.status = RegStatus.canceled; }
}