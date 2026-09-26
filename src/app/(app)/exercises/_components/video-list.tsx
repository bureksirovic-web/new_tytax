'use client';
import { useSyncExternalStore } from 'react';
import type { Exercise } from '@/contracts/domain';
import { useT } from '@/lib/i18n/use-t';
import { SectionCard } from './section-card';
import { buildVideoLinks } from './video-links';

const ICON_SEARCH = '⌕';
const ICON_PLAY = '▶';

function subscribe(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}
const getOnline = () => navigator.onLine;
const getServerOnline = () => true;

const linkBase =
  'flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-amber-400';

/** Exercise videos: TYTAX app link first (primary), YouTube links, then a YouTube search. */
export function VideoList({ exercise }: { exercise: Exercise }) {
  const { t } = useT();
  const online = useSyncExternalStore(subscribe, getOnline, getServerOnline);
  const links = buildVideoLinks(exercise.videos, exercise.name);

  return (
    <SectionCard title={t('ex_videos')} id="ex-videos" testId="exercise-videos">
      {!online && (
        <p role="status" className="mb-2 text-xs text-fg-muted">
          {t('ex_video_offline')}
        </p>
      )}
      <ul className="flex flex-wrap gap-2">
        {links.map((l, i) => {
          const label = t(l.labelKey, l.vars);
          const primary = i === 0 && l.kind === 'tytax';
          return (
            <li key={`${l.href}-${i}`}>
              <a
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('ex_video_new_tab', { label })}
                className={`${linkBase} ${primary ? 'border-accent bg-accent text-white hover:bg-accent-hover' : 'border-line bg-bg-2 text-fg-2 hover:bg-card-hover hover:text-fg'}`}
              >
                <span aria-hidden="true">{l.kind === 'search' ? ICON_SEARCH : ICON_PLAY}</span>
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}
