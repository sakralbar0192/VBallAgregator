// Доменные события системы волейбольного агрегатора
export type DomainEvent = {
  type: string;
  occurredAt: Date;
  payload: any;
  id: string;
};

// Событие создания новой игры
export interface GameCreated extends DomainEvent {
  type: 'GameCreated';
  payload: {
    gameId: string;
    startsAt: string;
    capacity: number;
    levelTag?: string;
    priceText?: string;
  };
}

// Событие записи игрока на игру
export interface PlayerJoined extends DomainEvent {
  type: 'PlayerJoined';
  payload: {
    gameId: string;
    userId: string;
    status: 'confirmed' | 'waitlisted';
  };
}

// Событие отмены регистрации
export interface RegistrationCanceled extends DomainEvent {
  type: 'RegistrationCanceled';
  payload: {
    gameId: string;
    userId: string;
  };
}

// Событие продвижения из листа ожидания
export interface WaitlistedPromoted extends DomainEvent {
  type: 'WaitlistedPromoted';
  payload: {
    gameId: string;
    userId: string;
  };
}

// Событие начала игры
export interface GameStarted extends DomainEvent {
  type: 'GameStarted';
  payload: {
    gameId: string;
  };
}

// Событие отметки оплаты
export interface PaymentMarked extends DomainEvent {
  type: 'PaymentMarked';
  payload: {
    gameId: string;
    userId: string;
  };
}

// События напоминаний
export interface GameReminder24h extends DomainEvent {
  type: 'GameReminder24h';
  payload: {
    gameId: string;
  };
}

export interface GameReminder2h extends DomainEvent {
  type: 'GameReminder2h';
  payload: {
    gameId: string;
  };
}

export interface PaymentReminder12h extends DomainEvent {
  type: 'PaymentReminder12h';
  payload: {
    gameId: string;
  };
}

export interface PaymentReminder24h extends DomainEvent {
  type: 'PaymentReminder24h';
  payload: {
    gameId: string;
  };
}