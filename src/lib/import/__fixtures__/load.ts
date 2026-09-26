import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Raw text of a fixture file, exactly as a user would upload it. */
export function loadFixtureText(file: string): string {
  return readFileSync(path.join(__dirname, file), 'utf8');
}
