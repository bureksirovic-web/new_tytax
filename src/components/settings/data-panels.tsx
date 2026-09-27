'use client';
import type { Profile } from '@/contracts/domain';
import { BackupPanel } from './backup-panel';
import { ExportPanel } from './export-panel';
import { PreMigrationPanel } from './premigration-panel';

/** Backup/restore, the pre-migration copy (when present), CSV export and legacy import; loaded lazily by the page. */
export function DataPanels({ profile }: { profile: Profile }) {
  return (
    <>
      <BackupPanel profile={profile} />
      <PreMigrationPanel />
      <ExportPanel profile={profile} />
    </>
  );
}
