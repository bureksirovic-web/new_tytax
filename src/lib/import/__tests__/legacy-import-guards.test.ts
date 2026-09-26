import { describe, expect, it } from 'vitest';
import { parseLegacyBackup } from '..';

describe('direct module guards', () => {
  it('parseAppBackup requires logs or sessionOrder; isImportError narrows', async () => {
    const { parseAppBackup } = await import('../parse-app-backup');
    const { isImportError } = await import('..');
    let caught: unknown;
    try {
      parseAppBackup({}, 'default', []);
    } catch (e) {
      caught = e;
    }
    expect(isImportError(caught)).toBe(true);
    expect(isImportError(new Error('x'))).toBe(false);
  });

  it('protocol without description keeps description undefined', () => {
    const p = { id: 9, name: 'P', description: '', data: { INITIAL_PLAN: {}, INITIAL_ORDER: [] } };
    const b = parseLegacyBackup({ logs: [], customProtocols: [p] });
    expect(b.users[0]?.customProtocols).toEqual([{ sourceId: '9', name: 'P', plan: {}, order: [] }]);
  });
});
