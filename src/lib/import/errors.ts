export type ImportErrorCode =
  | 'TOO_LARGE'
  | 'INVALID_JSON'
  | 'UNSAFE_KEYS'
  | 'UNRECOGNIZED_FORMAT'
  | 'INVALID_STRUCTURE';

/** Thrown when the input as a whole cannot be imported. Record-level problems are warnings instead. */
export class ImportError extends Error {
  readonly code: ImportErrorCode;
  readonly path: string;

  constructor(code: ImportErrorCode, message: string, path = '') {
    super(message);
    this.name = 'ImportError';
    this.code = code;
    this.path = path;
  }
}

export function isImportError(e: unknown): e is ImportError {
  return e instanceof ImportError;
}
