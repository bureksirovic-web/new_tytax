import { describe, expect, it } from 'vitest';
import { sequentialIds } from '@/contracts/fixtures';
import { buildProgramTemplate, generateSessions, SPLIT_OPTIONS } from '../program-builder';

describe('generateSessions', () => {
  it('cycles the split pattern and suffixes each round when the week is longer than the pattern', () => {
    const sessions = generateSessions('upper_lower', 4, sequentialIds('s'));
    expect(sessions.map((s) => s.name)).toEqual(['Upper A', 'Lower A', 'Upper B', 'Lower B']);
    // dayIndex is the position in the week: 0..3 for 4 days
    expect(sessions.map((s) => s.dayIndex)).toEqual([0, 1, 2, 3]);
    expect(sessions.every((s) => s.exercises.length === 0 && s.programId === '')).toBe(true);
    expect(sessions.map((s) => s.id)).toEqual(['s-1', 's-2', 's-3', 's-4']);
  });

  it('adds no suffix when the pattern fits the week exactly', () => {
    const sessions = generateSessions('push_pull_legs', 3, sequentialIds('s'));
    expect(sessions.map((s) => s.name)).toEqual(['Push', 'Pull', 'Legs']);
  });

  it('suffixes a single-session pattern for every extra day', () => {
    const sessions = generateSessions('full_body', 3, sequentialIds('s'));
    expect(sessions.map((s) => s.name)).toEqual(['Full Body A', 'Full Body B', 'Full Body C']);
  });

  it('returns no sessions for a non-positive frequency', () => {
    expect(generateSessions('custom', 0)).toEqual([]);
    expect(generateSessions('custom', -2)).toEqual([]);
  });
});

describe('buildProgramTemplate', () => {
  it('builds a non-preset template with a trimmed name and the rotation at the first session', () => {
    const template = buildProgramTemplate(
      { name: '  My PPL  ', modality: 'tytax', split: 'push_pull_legs', frequency: 6 },
      sequentialIds('s'),
    );
    expect(template.name).toBe('My PPL');
    expect(template.splitType).toBe('push_pull_legs');
    // 6 days over a 3-session pattern → 6 sessions
    expect(template.sessions).toHaveLength(6);
    expect(template.frequency).toBe(6);
    expect(template.sessionOrder).toEqual(['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B']);
    expect(template.modalitiesUsed).toEqual(['tytax']);
    expect(template.isPreset).toBe(false);
    expect(template.periodizationType).toBe('none');
    expect(template.currentSessionIndex).toBe(0);
    expect(template).not.toHaveProperty('presetId');
  });

  it('never offers fewer days than a split needs', () => {
    const ppl = SPLIT_OPTIONS.find((o) => o.value === 'push_pull_legs');
    // push/pull/legs needs one day per session → 3
    expect(ppl?.minDays).toBe(3);
  });
});
