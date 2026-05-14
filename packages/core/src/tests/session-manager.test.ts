import { UserSessionManager } from "../shared/session-manager.js";


describe('UserSessionManager', () => {
  let sessionManager: UserSessionManager;

  beforeEach(() => {
    // Reset the singleton instance before each test
    const privateInstance = UserSessionManager as any;
    privateInstance.instance = null;
    sessionManager = UserSessionManager.getInstance();
  });

  test('should create a singleton instance', () => {
    const anotherInstance = UserSessionManager.getInstance();
    expect(sessionManager).toBe(anotherInstance);
  });

  test('should create a new session', () => {
    const session = sessionManager.create('123');
    expect(session).toBeDefined();
    expect(session.userId).toBe('123');
    expect(session.isActive).toBe(true);
  });

  test('should terminate existing session when creating a new one', () => {
    const firstSession = sessionManager.create('123');
    const secondSession = sessionManager.create('456');

    expect(firstSession.isActive).toBe(false);
    expect(secondSession.isActive).toBe(true);
  });

  test('should store and retrieve input', () => {
    sessionManager.create('123');
    sessionManager.storeInput('name', 'John');
    sessionManager.storeInput('age', 30);

    expect(sessionManager.getInput('name')).toBe('John');
    expect(sessionManager.getInput('age')).toBe(30);
  });

  test('should throw error when storing input without active session', () => {
    expect(() => {
      sessionManager.storeInput('name', 'John');
    }).toThrow('No active session');
  });

  test('should extend session', () => {
    const session = sessionManager.create('123');
    const originalExpirationTime = session.expiresAt;
    
    sessionManager.extendSession();
    
    expect(session.expiresAt.getTime()).toBeGreaterThan(originalExpirationTime.getTime());
  });

  test('should invalidate expired session', () => {
    const session = sessionManager.create('123', 1); // Very short session
    
    // Wait for session to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const currentSession = sessionManager.getCurrentSession();
        expect(currentSession).toBeNull();
        resolve();
      }, 10);
    });
  });
});