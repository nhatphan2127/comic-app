import { describe, expect, it } from 'vitest';
import { createLogFormat } from '../src/config/logger.js';

describe('structured log format', () => {
  it('emits the shared JSON record fields and preserves event metadata', () => {
    const format = createLogFormat('audit', 'comic-app.audit');
    const info = format.transform({
      level: 'info',
      message: 'User role changed',
      event: { action: 'admin.user.updated', category: 'database' },
      user: { id: 'user-1' },
    }, {});

    const record = JSON.parse(info[Symbol.for('message')]);
    expect(record.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(record.log).toEqual({ level: 'info' });
    expect(record.process.pid).toBe(process.pid);
    expect(record.labels.app).toBe('comic-app');
    expect(record.thread.name).toBe('main');
    expect(record.logger).toBe('comic-app.audit');
    expect(record.service.name).toBe('comic-app-backend');
    expect(record.event).toEqual({
      action: 'admin.user.updated',
      category: 'database',
      dataset: 'audit',
    });
    expect(record.user).toEqual({ id: 'user-1' });
  });
});
