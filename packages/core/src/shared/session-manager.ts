import { v4 as uuidv4 } from 'uuid';
import { EnhancedConsoleLogger } from './enhanced-logger.js';

interface UserSessionData {
  [key: string]: any;
}

interface UserSession {
  id: string;
  userId?: string;
  createdAt: Date;
  expiresAt: Date;
  data: UserSessionData;
  isActive: boolean;
}

export class UserSessionManager {
  private static instance: UserSessionManager;
  private currentSession: UserSession | null = null;
  private logger: EnhancedConsoleLogger;

  private constructor() {
    this.logger = new EnhancedConsoleLogger();
  }

  public static getInstance(): UserSessionManager {
    if (!UserSessionManager.instance) {
      UserSessionManager.instance = new UserSessionManager();
    }
    return UserSessionManager.instance;
  }

  public create(userId?: string, sessionDuration: number = 30 * 60 * 1000): UserSession {
    // Terminate any existing session
    this.terminate();

    const now = new Date();
    const session: UserSession = {
      id: uuidv4(),
      userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + sessionDuration),
      data: {},
      isActive: true
    };

    this.currentSession = session;
    this.logger.info(`New session created: ${session.id} for user: ${userId}`);
    return session;
  }

  public terminate(): void {
    if (this.currentSession) {
      this.logger.info(`Terminating session: ${this.currentSession.id}`);
      this.currentSession.isActive = false;
      this.currentSession = null;
    }
  }

  public getCurrentSession(): UserSession | null {
    if (this.currentSession && this.isSessionValid()) {
      return this.currentSession;
    }
    return null;
  }

  public storeInput(key: string, value: any): void {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    this.currentSession.data[key] = value;
    this.logger.debug(`Stored input for key: ${key}`);
  }

  public getInput(key: string): any {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    return this.currentSession.data[key];
  }

  public extendSession(additionalTime: number = 15 * 60 * 1000): void {
    if (!this.currentSession) {
      throw new Error('No active session');
    }
    this.currentSession.expiresAt = new Date(
      this.currentSession.expiresAt.getTime() + additionalTime
    );
    this.logger.info(`Session extended: ${this.currentSession.id}`);
  }

  private isSessionValid(): boolean {
    if (!this.currentSession) return false;
    const now = new Date();
    const isValid = this.currentSession.isActive && now < this.currentSession.expiresAt;
    
    if (!isValid) {
      this.logger.warn('Session expired or invalidated');
      this.terminate();
    }

    return isValid;
  }
}

export const sessionManager = UserSessionManager.getInstance();