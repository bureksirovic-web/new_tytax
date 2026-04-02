import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrograms = vi.hoisted(() => ({
  get: vi.fn(),
  where: vi.fn(),
  update: vi.fn(),
  add: vi.fn(),
  toArray: vi.fn(),
}));

function makeWhereMock() {
  const andFn = vi.fn().mockReturnThis();
  const equalsFn = vi.fn().mockReturnValue({
    and: andFn,
    toArray: mockPrograms.toArray,
  });
  return {
    equals: equalsFn,
  };
}

vi.mock('@/lib/db/dexie', () => ({
  db: {
    programs: mockPrograms,
  },
}));

vi.mock('@/lib/utils', () => ({
  generateId: () => 'generated-id-123',
  isoDate: () => '2024-01-15',
}));

const { activateProgram, deleteProgram, installPreset, advanceSession, getCurrentSession } = await import('../utils');
import type { Program } from '@/types/program';

describe('activateProgram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeProgram(overrides: Partial<Program> = {}): Program {
    return {
      id: 'prog-1',
      profileId: 'profile-1',
      name: 'Test Program',
      splitType: 'full_body',
      frequency: 3,
      periodizationType: 'none',
      sessionOrder: ['Session A'],
      sessions: [{ id: 'sess-1', programId: 'prog-1', name: 'Session A', dayIndex: 0, exercises: [] }],
      modalitiesUsed: ['tytax'],
      isActive: false,
      isPreset: false,
      currentSessionIndex: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      ...overrides,
    };
  }

  it('sets isActive correctly on the target program', async () => {
    const targetProgram = makeProgram();

    mockPrograms.get.mockResolvedValue(targetProgram);
    mockPrograms.where.mockReturnValue(makeWhereMock());
    mockPrograms.toArray.mockResolvedValue([]);
    mockPrograms.update.mockResolvedValue(undefined);

    await activateProgram('prog-1');

    expect(mockPrograms.update).toHaveBeenCalledWith('prog-1', {
      isActive: true,
      currentSessionIndex: 0,
      updatedAt: '2024-01-15',
    });
  });

  it('deactivates other programs for the same profile', async () => {
    const targetProgram = makeProgram();
    const activeProgram = makeProgram({ id: 'prog-2', isActive: true });

    mockPrograms.get.mockResolvedValue(targetProgram);
    mockPrograms.where.mockReturnValue(makeWhereMock());
    mockPrograms.toArray.mockResolvedValue([activeProgram]);
    mockPrograms.update.mockResolvedValue(undefined);

    await activateProgram('prog-1');

    expect(mockPrograms.update).toHaveBeenCalledWith('prog-2', {
      isActive: false,
      updatedAt: '2024-01-15',
    });
  });

  it('does nothing if target program does not exist', async () => {
    mockPrograms.get.mockResolvedValue(undefined);

    await activateProgram('nonexistent');

    expect(mockPrograms.update).not.toHaveBeenCalled();
  });
});

describe('deleteProgram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets deletedAt on the program', async () => {
    mockPrograms.update.mockResolvedValue(undefined);

    await deleteProgram('prog-1');

    expect(mockPrograms.update).toHaveBeenCalledWith('prog-1', {
      deletedAt: expect.any(String),
      isActive: false,
      updatedAt: '2024-01-15',
    });
  });
});

describe('installPreset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates program from preset', async () => {
    const preset: Program = {
      id: 'preset_test',
      profileId: 'preset',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      name: 'Preset Program',
      splitType: 'upper_lower',
      frequency: 4,
      periodizationType: 'linear',
      sessionOrder: ['Upper', 'Lower'],
      sessions: [
        { id: 's1', programId: '', name: 'Upper', dayIndex: 0, exercises: [] },
        { id: 's2', programId: '', name: 'Lower', dayIndex: 1, exercises: [] },
      ],
      modalitiesUsed: ['tytax'],
      isPreset: true,
      currentSessionIndex: 0,
      isActive: false,
    };

    mockPrograms.add.mockResolvedValue('generated-id-123');

    const result = await installPreset(preset, 'profile-1');

    expect(result).toBe('generated-id-123');
    expect(mockPrograms.add).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generated-id-123',
        profileId: 'profile-1',
        isActive: false,
        currentSessionIndex: 0,
        createdAt: '2024-01-15',
        updatedAt: '2024-01-15',
        name: 'Preset Program',
      }),
    );
  });
});

describe('advanceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeProgram(overrides: Partial<Program> = {}): Program {
    return {
      id: 'prog-1',
      profileId: 'profile-1',
      name: 'Test',
      splitType: 'full_body',
      frequency: 3,
      periodizationType: 'none',
      sessionOrder: ['A', 'B', 'C'],
      sessions: [
        { id: 's1', programId: 'prog-1', name: 'A', dayIndex: 0, exercises: [] },
        { id: 's2', programId: 'prog-1', name: 'B', dayIndex: 1, exercises: [] },
        { id: 's3', programId: 'prog-1', name: 'C', dayIndex: 2, exercises: [] },
      ],
      modalitiesUsed: ['tytax'],
      isActive: true,
      isPreset: false,
      currentSessionIndex: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      ...overrides,
    };
  }

  it('moves to next session', async () => {
    const program = makeProgram({ currentSessionIndex: 0 });

    mockPrograms.get.mockResolvedValue(program);
    mockPrograms.update.mockResolvedValue(undefined);

    await advanceSession('prog-1');

    expect(mockPrograms.update).toHaveBeenCalledWith('prog-1', {
      currentSessionIndex: 1,
      updatedAt: '2024-01-15',
    });
  });

  it('wraps around to first session', async () => {
    const program = makeProgram({
      currentSessionIndex: 1,
      sessions: [
        { id: 's1', programId: 'prog-1', name: 'A', dayIndex: 0, exercises: [] },
        { id: 's2', programId: 'prog-1', name: 'B', dayIndex: 1, exercises: [] },
      ],
      sessionOrder: ['A', 'B'],
    });

    mockPrograms.get.mockResolvedValue(program);
    mockPrograms.update.mockResolvedValue(undefined);

    await advanceSession('prog-1');

    expect(mockPrograms.update).toHaveBeenCalledWith('prog-1', {
      currentSessionIndex: 0,
      updatedAt: '2024-01-15',
    });
  });

  it('does nothing if program does not exist', async () => {
    mockPrograms.get.mockResolvedValue(undefined);

    await advanceSession('nonexistent');

    expect(mockPrograms.update).not.toHaveBeenCalled();
  });
});

describe('getCurrentSession', () => {
  it('returns the current session', () => {
    const program: Program = {
      id: 'prog-1',
      profileId: 'profile-1',
      name: 'Test',
      splitType: 'full_body',
      frequency: 3,
      periodizationType: 'none',
      sessionOrder: ['A', 'B'],
      sessions: [
        { id: 's1', programId: 'prog-1', name: 'A', dayIndex: 0, exercises: [] },
        { id: 's2', programId: 'prog-1', name: 'B', dayIndex: 1, exercises: [] },
      ],
      modalitiesUsed: ['tytax'],
      isActive: true,
      isPreset: false,
      currentSessionIndex: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    const session = getCurrentSession(program);
    expect(session).toBeDefined();
    expect(session!.name).toBe('B');
  });

  it('returns null for empty sessions', () => {
    const program: Program = {
      id: 'prog-1',
      profileId: 'profile-1',
      name: 'Test',
      splitType: 'full_body',
      frequency: 3,
      periodizationType: 'none',
      sessionOrder: [],
      sessions: [],
      modalitiesUsed: ['tytax'],
      isActive: true,
      isPreset: false,
      currentSessionIndex: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    expect(getCurrentSession(program)).toBeNull();
  });
});
