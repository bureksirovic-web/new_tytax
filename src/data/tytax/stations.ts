// Generated data: `src/data/tytax/library.json` is written by `npm run catalog:build`
// from tytax_library.json STATIONS. Ids are the library keys (SMITH, BACK_UPPER, …).
import type { Station } from '@/contracts/domain';
import library from './library.json';

export const TYTAX_STATIONS: readonly Station[] = Object.freeze(library.stations.map((s) => Object.freeze({ ...s })));
