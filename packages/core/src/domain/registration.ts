export enum RegStatus {
  confirmed = 'confirmed',
  waitlisted = 'waitlisted',
  canceled = 'canceled'
}

export enum PaymentStatus {
  unpaid = 'unpaid',
  paid = 'paid'
}

import { ERROR_CODES } from './errors.js';
import { BusinessRuleError } from './errors/business-rule-error.js';
import type { Game } from './game.js';

export class Registration {
  constructor(
    readonly id: string,
    readonly gameId: string,
    readonly userId: string,
    private _status: RegStatus,
    public paymentStatus: PaymentStatus = PaymentStatus.unpaid,
    public paymentMarkedAt?: Date,
    readonly createdAt: Date = new Date(),
  ) {}

  get status(): RegStatus {
    return this._status;
  }

  markPaid(game: Game) {
    if (!game.isPaymentWindowOpen) throw new BusinessRuleError(ERROR_CODES.PAYMENT_WINDOW_NOT_OPEN, 'Окно оплаты еще не открыто');
    if (this.status !== RegStatus.confirmed) throw new BusinessRuleError(ERROR_CODES.NOT_CONFIRMED, 'Только подтвержденные участники могут отмечать оплату');
    this.paymentStatus = PaymentStatus.paid;
    this.paymentMarkedAt = new Date();
  }

  cancel() { this._status = RegStatus.canceled; }

  reactivate(newStatus: RegStatus) {
    this._status = newStatus;
  }
}