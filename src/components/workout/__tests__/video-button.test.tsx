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

  // URL safety and host classification, carried over from the deleted local
  // runtime/video-links.test.ts (the button now uses G1's buildVideoLinks).
  it('never links a non-http(s) url: all unsafe → the search link', () => {
    render(
      <VideoButton
        name="Row"
        modality="tytax"
        exercise={{ videos: [{ url: 'javascript:alert(1)', label: 'x' }, { url: ' JavaScript:alert(1)', label: 'v' }, { url: 'data:text/html,<b>', label: 'v' }, { url: 'ftp://a.com/v', label: 'v' }, { url: '/relative', label: 'v' }, { url: 'not a url', label: 'v' }] }}
      />,
    );
    const link = screen.getByTestId('video-button');
    // tytax modality: G1 appends " TYTAX" to the query.
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/results?search_query=Row%20TYTAX');
  });

  it('look-alike hosts are neither tytax nor YouTube, unsafe entries are dropped from the menu, no search entry', () => {
    render(
      <VideoButton
        name="Row"
        exercise={{
          modality: 'tytax',
          videos: [
            { url: 'https://eviltytax.com/a', label: 'v' },
            { url: 'javascript:alert(1)', label: 'v' },
            { url: 'https://youtube.com.evil.io/a', label: 'v' },
            { url: 'https://app.tytax.com/v/1', label: 'v' },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByTestId('video-button'));
    const options = screen.getAllByTestId('video-option');
    // app.tytax first, then the two look-alikes as 'other' in catalog order; the search is not in the menu.
    expect(options.map((o) => o.getAttribute('href'))).toEqual(['https://app.tytax.com/v/1', 'https://eviltytax.com/a', 'https://youtube.com.evil.io/a']);
    expect(options.map((o) => o.textContent)).toEqual(['Row · TYTAX app', 'Row · Video 1', 'Row · Video 2']);
  });
});
