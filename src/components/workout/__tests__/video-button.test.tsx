import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { VideoButton } from '../video-button';

describe('VideoButton', () => {
  it('links straight to the only video', () => {
    render(<VideoButton name="Bench" exercise={{ videos: [{ url: 'https://www.youtube.com/watch?v=abc', label: 'YouTube' }] }} />);
    const link = screen.getByTestId('video-button');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('falls back to a YouTube search without videos (or without a catalog entry)', () => {
    render(<VideoButton name="TYTAX T1 | Smith Squat" />);
    const link = screen.getByTestId('video-button');
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/results?search_query=Smith%20Squat');
    expect(link.tagName).toBe('A');
  });

  it('opens a menu for several videos, tytax first, and closes on Escape', () => {
    render(
      <VideoButton
        name="Row"
        exercise={{
          videos: [
            { url: 'https://youtu.be/xyz', label: 'YT' },
            { url: 'https://app.tytax.com/v/1', label: 'TYTAX' },
          ],
        }}
      />,
    );
    const button = screen.getByTestId('video-button');
    expect(button.tagName).toBe('BUTTON');
    expect(screen.queryByTestId('video-menu')).toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    const options = screen.getAllByTestId('video-option');
    expect(options.map((o) => o.getAttribute('href'))).toEqual(['https://app.tytax.com/v/1', 'https://youtu.be/xyz']);
    expect(options[0]).toHaveTextContent('TYTAX');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('video-menu')).toBeNull();
  });

  it('returns focus to the trigger when Escape closes the menu from a link', () => {
    render(<VideoButton name="Row" exercise={{ videos: [{ url: 'https://youtu.be/a', label: 'A' }, { url: 'https://youtu.be/b', label: 'B' }] }} />);
    const button = screen.getByTestId('video-button');
    fireEvent.click(button);
    const option = screen.getAllByTestId('video-option')[1];
    option.focus();
    expect(document.activeElement).toBe(option);
    fireEvent.keyDown(option, { key: 'Escape' });
    expect(screen.queryByTestId('video-menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});
