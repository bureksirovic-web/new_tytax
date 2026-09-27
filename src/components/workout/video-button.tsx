'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { Exercise, Modality } from '@/contracts/domain';
import { buildVideoLinks, type VideoLink } from '@/lib/catalog';
import { useSetsStrings } from './strings/sets';
import { PlayIcon } from './icons';

export interface VideoButtonProps {
  /** Name used for the YouTube search fallback and labels. */
  name: string;
  /** Session modality (a TYTAX search gets " TYTAX" appended); the catalog entry's wins. */
  modality?: Modality;
  /** Catalog entry; undefined while the catalog loads (search link meanwhile). */
  exercise?: Pick<Exercise, 'videos'> & Partial<Pick<Exercise, 'modality'>>;
}

const iconButton =
  'flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]';

/**
 * Links from G1's `buildVideoLinks` (http(s) only: app.tytax → YouTube →
 * other, then a YouTube search). One video → direct <a>; several → a menu of
 * the videos; none → the search link.
 */
export function VideoButton({ name, modality, exercise }: VideoButtonProps) {
  const t = useSetsStrings();
  const all = buildVideoLinks({ name, modality: exercise?.modality ?? modality ?? 'custom', videos: exercise?.videos });
  const videos = all.filter((l) => l.kind !== 'search');
  const single = videos.length === 0 ? all[all.length - 1] : videos.length === 1 ? videos[0] : undefined;

  if (single) {
    const label = `${name}: ${single.kind === 'search' ? t('card_video_search') : t('card_video')}`;
    return (
      <a data-testid="video-button" href={single.href} target="_blank" rel="noopener noreferrer" aria-label={label} className={iconButton}>
        <PlayIcon />
      </a>
    );
  }
  return <VideoMenu name={name} links={videos} label={`${name}: ${t('card_video_menu')}`} />;
}

function VideoMenu({ name, links, label }: { name: string; links: VideoLink[]; label: string }) {
  const t = useSetsStrings();
  const optionText = (link: VideoLink): string =>
    link.kind === 'tytax' ? t('card_video_tytax') : link.kind === 'youtube' ? t('card_video_youtube', { n: link.n ?? 1 }) : t('card_video_option', { n: link.n ?? 1 });
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** Closes the menu; focus inside it (which is about to unmount) goes back to the trigger. */
  const close = () => {
    if (rootRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (rootRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
      setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="video-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={iconButton}
      >
        <PlayIcon />
      </button>
      {open && (
        <ul
          id={menuId}
          data-testid="video-menu"
          aria-label={label}
          className="absolute right-0 z-20 mt-1 min-w-48 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-xl"
        >
          {links.map((link) => (
            <li key={link.href}>
              <a
                data-testid="video-option"
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="flex min-h-11 items-center rounded-md px-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--highlight)]"
              >
                {`${name} · ${optionText(link)}`}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
