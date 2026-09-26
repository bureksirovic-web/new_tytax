// Generated data: `src/data/tytax/library.json` is written by `npm run catalog:build`
// from tytax_library.json RECOMMENDED_ATTACHMENTS (ids in scripts/data/station-rules.ts).
import type { AttachmentDef } from '@/contracts/domain';
import library from './library.json';

export const TYTAX_ATTACHMENTS: readonly AttachmentDef[] = Object.freeze(library.attachments.map((a) => Object.freeze({ ...a })));
