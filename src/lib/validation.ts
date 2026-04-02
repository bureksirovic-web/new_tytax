type TypeCheck =
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'nullable';

interface FieldSchema {
  type: TypeCheck | TypeCheck[];
  required?: boolean;
  nested?: SchemaDefinition;
  itemSchema?: FieldSchema;
}

export type SchemaDefinition = Record<string, FieldSchema>;

export interface ValidationResult<T> {
  valid: true;
  data: T;
}

export interface ValidationFailure {
  valid: false;
  errors: string[];
}

export type ValidateResult<T> = ValidationResult<T> | ValidationFailure;

function checkType(value: unknown, expected: TypeCheck): boolean {
  if (value === null || value === undefined) {
    return expected === 'nullable';
  }
  switch (expected) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && !Array.isArray(value);
    case 'nullable':
      return true;
    default:
      return false;
  }
}

function typeLabel(types: TypeCheck | TypeCheck[]): string {
  if (Array.isArray(types)) return types.join(' | ');
  return types;
}

function validateObject(
  value: unknown,
  schema: SchemaDefinition,
  path: string
): { stripped: Record<string, unknown>; errors: string[] } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      stripped: {},
      errors: [`${path || 'root'} must be an object`],
    };
  }

  const obj = value as Record<string, unknown>;
  const stripped: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [field, fieldSchema] of Object.entries(schema)) {
    const fullPath = path ? `${path}.${field}` : field;
    const val = obj[field];

    if (val === undefined || val === null) {
      if (fieldSchema.required) {
        errors.push(`${fullPath} is required`);
      }
      continue;
    }

    const types = Array.isArray(fieldSchema.type)
      ? fieldSchema.type
      : [fieldSchema.type];

    if (!types.some((t) => checkType(val, t))) {
      errors.push(
        `${fullPath} must be ${typeLabel(fieldSchema.type)}, got ${val === null ? 'null' : typeof val}`
      );
      continue;
    }

    if (
      fieldSchema.nested &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      const nestedResult = validateObject(val, fieldSchema.nested, fullPath);
      errors.push(...nestedResult.errors);
      stripped[field] = nestedResult.stripped;
    } else if (fieldSchema.itemSchema && Array.isArray(val)) {
      const items: unknown[] = [];
      val.forEach((item, idx) => {
        if (fieldSchema.itemSchema?.nested) {
          const itemResult = validateObject(
            item,
            fieldSchema.itemSchema.nested,
            `${fullPath}[${idx}]`
          );
          errors.push(...itemResult.errors);
          items.push(itemResult.stripped);
        } else if (fieldSchema.itemSchema?.type) {
          const itemTypes = Array.isArray(fieldSchema.itemSchema.type)
            ? fieldSchema.itemSchema.type
            : [fieldSchema.itemSchema.type];
          if (!itemTypes.some((t) => checkType(item, t))) {
            errors.push(
              `${fullPath}[${idx}] must be ${typeLabel(fieldSchema.itemSchema.type)}`
            );
          } else {
            items.push(item);
          }
        } else {
          items.push(item);
        }
      });
      stripped[field] = items;
    } else {
      stripped[field] = val;
    }
  }

  return { stripped, errors };
}

export function validate<T extends Record<string, unknown>>(
  data: unknown,
  schema: SchemaDefinition
): ValidateResult<T> {
  const { stripped, errors } = validateObject(data, schema, '');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: stripped as T };
}

// ─── LoggedSet schema ────────────────────────────────────────────────
const LoggedSetSchema: SchemaDefinition = {
  id: { type: 'string', required: true },
  setNumber: { type: 'number', required: true },
  type: { type: 'string', required: true },
  kg: { type: 'number', required: true },
  reps: { type: 'number', required: true },
  rir: { type: ['number', 'nullable'] },
  tempo: { type: ['string', 'nullable'] },
  done: { type: 'boolean', required: true },
  isPersonalRecord: { type: ['boolean', 'nullable'] },
  e1rm: { type: ['number', 'nullable'] },
  timestamp: { type: 'string', required: true },
};

// ─── ExerciseLog schema ──────────────────────────────────────────────
const ExerciseLogSchema: SchemaDefinition = {
  exerciseRef: { type: 'string', required: true },
  exerciseName: { type: 'string', required: true },
  modality: { type: 'string', required: true },
  supersetGroup: { type: ['string', 'nullable'] },
  sets: {
    type: 'array',
    required: true,
    itemSchema: { type: 'object', nested: LoggedSetSchema },
  },
  restSeconds: { type: ['number', 'nullable'] },
  notes: { type: ['string', 'nullable'] },
  muscleImpactSnapshot: {
    type: ['array', 'nullable'],
    itemSchema: {
      type: 'object',
      nested: {
        muscle: { type: 'string', required: true },
        score: { type: 'number', required: true },
      },
    },
  },
};

// ─── WorkoutLog schema ───────────────────────────────────────────────
export const WorkoutLogSchema: SchemaDefinition = {
  id: { type: 'string', required: true },
  sessionName: { type: 'string', required: true },
  date: { type: 'string', required: true },
  startedAt: { type: 'string', required: true },
  finishedAt: { type: ['string', 'nullable'] },
  durationSeconds: { type: 'number', required: true },
  exercises: {
    type: 'array',
    required: true,
    itemSchema: { type: 'object', nested: ExerciseLogSchema },
  },
  notes: { type: ['string', 'nullable'] },
  rpe: { type: ['number', 'nullable'] },
  bodyweightKg: { type: ['number', 'nullable'] },
  totalVolumeKg: { type: 'number', required: true },
  totalSets: { type: 'number', required: true },
  prCount: { type: 'number', required: true },
  modalitiesUsed: {
    type: 'array',
    required: true,
    itemSchema: { type: 'string' },
  },
  createdAt: { type: 'string', required: true },
  updatedAt: { type: 'string', required: true },
  deletedAt: { type: ['string', 'nullable'] },
  syncedAt: { type: ['string', 'nullable'] },
  familyMemberId: { type: ['string', 'nullable'] },
  programId: { type: ['string', 'nullable'] },
};

// ─── UserProfile schema ──────────────────────────────────────────────
export const ProfileSchema: SchemaDefinition = {
  id: { type: 'string' },
  displayName: { type: 'string', required: true },
  language: { type: 'string', required: true },
  unitSystem: { type: 'string', required: true },
  theme: { type: 'string', required: true },
  bodyweightKg: { type: ['number', 'nullable'] },
  gender: { type: ['string', 'nullable'] },
  experienceLevel: { type: ['string', 'nullable'] },
  activeFamilyMemberId: { type: ['string', 'nullable'] },
  activeEquipmentProfileId: { type: ['string', 'nullable'] },
  warmupStrategy: { type: 'string', required: true },
  autoBackup: { type: 'boolean', required: true },
  barWeightKg: { type: 'number', required: true },
  isAnonymous: { type: 'boolean', required: true },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
};

// ─── PRRecord schema ─────────────────────────────────────────────────
export const PRRecordSchema: SchemaDefinition = {
  id: { type: 'string', required: true },
  exerciseId: { type: 'string', required: true },
  exerciseName: { type: 'string', required: true },
  prType: { type: 'string', required: true },
  value: { type: 'number', required: true },
  reps: { type: ['number', 'nullable'] },
  achievedAt: { type: 'string', required: true },
  workoutLogId: { type: 'string', required: true },
};

// ─── BodyweightEntry schema ──────────────────────────────────────────
export const BodyweightEntrySchema: SchemaDefinition = {
  id: { type: 'string', required: true },
  date: { type: 'string', required: true },
  valueKg: { type: 'number', required: true },
  createdAt: { type: 'string', required: true },
};

// ─── Program schema (simplified — top-level fields) ──────────────────
const ProgramSessionSchema: SchemaDefinition = {
  id: { type: 'string', required: true },
  name: { type: 'string', required: true },
  dayIndex: { type: 'number', required: true },
  exercises: {
    type: 'array',
    required: true,
    itemSchema: {
      type: 'object',
      nested: {
        exerciseId: { type: 'string', required: true },
        exerciseName: { type: 'string', required: true },
        modality: { type: 'string', required: true },
        sets: { type: 'number', required: true },
        reps: { type: 'string', required: true },
        tempo: { type: ['string', 'nullable'] },
        restSeconds: { type: ['number', 'nullable'] },
        supersetGroup: { type: ['string', 'nullable'] },
      },
    },
  },
};

export const ProgramSchema: SchemaDefinition = {
  id: { type: 'string', required: true },
  name: { type: 'string', required: true },
  splitType: { type: 'string', required: true },
  frequency: { type: 'number', required: true },
  periodizationType: { type: 'string', required: true },
  periodizationConfig: { type: ['object', 'nullable'] },
  sessionOrder: {
    type: 'array',
    required: true,
    itemSchema: { type: 'string' },
  },
  sessions: {
    type: 'array',
    required: true,
    itemSchema: { type: 'object', nested: ProgramSessionSchema },
  },
  modalitiesUsed: {
    type: 'array',
    required: true,
    itemSchema: { type: 'string' },
  },
  isActive: { type: 'boolean', required: true },
  isPreset: { type: 'boolean', required: true },
  currentSessionIndex: { type: 'number', required: true },
  rotationStartDate: { type: ['string', 'nullable'] },
  createdAt: { type: 'string', required: true },
  updatedAt: { type: 'string', required: true },
  deletedAt: { type: ['string', 'nullable'] },
};

// ─── Table → Schema map for sync route ───────────────────────────────
const TABLE_SCHEMAS: Record<string, SchemaDefinition> = {
  workout_logs: WorkoutLogSchema,
  profiles: ProfileSchema,
  pr_records: PRRecordSchema,
  bodyweight_entries: BodyweightEntrySchema,
  programs: ProgramSchema,
};

export function getTableSchema(tableName: string): SchemaDefinition | null {
  return TABLE_SCHEMAS[tableName] ?? null;
}

// ─── SyncOperation payload validator ─────────────────────────────────
export interface ValidatedSyncOperation {
  id: string;
  tableName: string;
  operationType: 'create' | 'update' | 'delete';
  recordId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const SyncOperationSchema: SchemaDefinition = {
  id: { type: 'string', required: true },
  tableName: { type: 'string', required: true },
  operationType: { type: 'string', required: true },
  recordId: { type: 'string', required: true },
  payload: { type: ['object', 'nullable'] },
  createdAt: { type: 'string', required: true },
  retryCount: { type: 'number', required: true },
  lastError: { type: ['string', 'nullable'] },
};

export function validateSyncOperation(
  op: unknown
): ValidateResult<ValidatedSyncOperation> {
  const result = validate<Record<string, unknown>>(op, SyncOperationSchema);
  if (!result.valid) return result;

  const opType = result.data.operationType;
  if (!['create', 'update', 'delete'].includes(opType as string)) {
    return {
      valid: false,
      errors: [`operationType must be create, update, or delete, got ${opType}`],
    };
  }

  return { valid: true, data: result.data as unknown as ValidatedSyncOperation };
}
