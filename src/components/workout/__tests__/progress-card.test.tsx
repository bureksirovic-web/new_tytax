import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProgressCard } from '../progress-card';
import type { ProgressionCandidate } from '../progression-candidate';

function candidate(over: Partial<ProgressionCandidate> = {}): ProgressionCandidate {
  return {
    exerciseId: 'bw_push_standard-push-up',
    exerciseName: 'Push-Up',
    nextExerciseId: 'bw_push_diamond-push-up',
    nextExerciseName: 'Diamond Push-Up',
    programId: 'prog-1',
    programSessionId: 'sess-1',
    youth: false,
    ...over,
  };
}

describe('ProgressCard', () => {
  it('renders the card and accepts immediately for a non-youth profile', async () => {
    const onAccept = vi.fn(async () => undefined);
    const onDismiss = vi.fn();
    render(<ProgressCard candidate={candidate()} onAccept={onAccept} onDismiss={onDismiss} />);

    expect(screen.getByTestId('progression-card')).toHaveAttribute('data-next-exercise-id', 'bw_push_diamond-push-up');
    expect(screen.queryByTestId('progression-youth-confirm')).toBeNull();
    expect(screen.getByTestId('progression-accept')).toBeEnabled();

    await act(async () => {
      fireEvent.click(screen.getByTestId('progression-accept'));
    });
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('a youth candidate needs the confirm checkbox before the accept button enables', async () => {
    const onAccept = vi.fn(async () => undefined);
    render(<ProgressCard candidate={candidate({ youth: true })} onAccept={onAccept} onDismiss={vi.fn()} />);

    const accept = screen.getByTestId('progression-accept');
    const confirm = screen.getByTestId('progression-youth-confirm');
    expect(accept).toBeDisabled();

    fireEvent.click(confirm);
    expect(accept).toBeEnabled();

    await act(async () => {
      fireEvent.click(accept);
    });
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('unchecking the youth confirmation disables accept again', () => {
    render(<ProgressCard candidate={candidate({ youth: true })} onAccept={vi.fn()} onDismiss={vi.fn()} />);
    const confirm = screen.getByTestId('progression-youth-confirm');
    fireEvent.click(confirm);
    expect(screen.getByTestId('progression-accept')).toBeEnabled();
    fireEvent.click(confirm);
    expect(screen.getByTestId('progression-accept')).toBeDisabled();
  });

  it('dismiss calls onDismiss without touching onAccept', () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();
    render(<ProgressCard candidate={candidate()} onAccept={onAccept} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByTestId('progression-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('shows an error and re-enables accept when the swap fails', async () => {
    const onAccept = vi.fn(async () => {
      throw new Error('offline');
    });
    render(<ProgressCard candidate={candidate()} onAccept={onAccept} onDismiss={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId('progression-accept'));
    });
    expect(screen.getByTestId('progression-card-error')).toBeInTheDocument();
    expect(screen.getByTestId('progression-accept')).toBeEnabled();
  });
});
