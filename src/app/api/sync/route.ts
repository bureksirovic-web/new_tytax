import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { SyncOperation } from '@/types/sync';
import {
  validate,
  validateSyncOperation,
  getTableSchema,
} from '@/lib/validation';

const ALLOWED_TABLES = new Set([
  'workout_logs',
  'programs',
  'profiles',
  'pr_records',
  'bodyweight_entries',
]);

interface SyncRequestBody {
  operations: SyncOperation[];
}

interface SyncResponseBody {
  synced: number;
  failed: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: SyncRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body?.operations)) {
    return NextResponse.json(
      { error: 'Body must contain an "operations" array' },
      { status: 400 }
    );
  }

  const result: SyncResponseBody = { synced: 0, failed: 0, errors: [] };

  for (const op of body.operations) {
    // Validate operation structure
    const opValidation = validateSyncOperation(op);
    if (!opValidation.valid) {
      result.failed++;
      result.errors.push(
        `Operation ${op?.id ?? 'unknown'}: ${opValidation.errors.join(', ')}`
      );
      continue;
    }

    const validated = opValidation.data;

    // Validate table is allowed
    if (!ALLOWED_TABLES.has(validated.tableName)) {
      result.failed++;
      result.errors.push(
        `Operation ${validated.id}: table "${validated.tableName}" is not allowed`
      );
      continue;
    }

    try {
      switch (validated.operationType) {
        case 'create':
        case 'update': {
          if (!validated.payload) {
            result.failed++;
            result.errors.push(`Operation ${validated.id}: missing payload for ${validated.operationType}`);
            continue;
          }

          // Validate payload against table-specific schema
          const schema = getTableSchema(validated.tableName);
          let upsertPayload: Record<string, unknown>;
          if (schema) {
            const payloadValidation = validate(validated.payload, schema);
            if (!payloadValidation.valid) {
              result.failed++;
              result.errors.push(
                `Operation ${validated.id}: ${payloadValidation.errors.join(', ')}`
              );
              continue;
            }
            upsertPayload = {
              ...(payloadValidation.data as Record<string, unknown>),
            };
          } else {
            upsertPayload = { ...validated.payload };
          }

          // Ensure profile_id is set for user-owned tables
          if (validated.tableName !== 'profiles' && !upsertPayload.profile_id) {
            upsertPayload.profile_id = user.id;
          }

          const { error: upsertError } = await supabase
            .from(validated.tableName)
            .upsert(upsertPayload)
            .select();
          if (upsertError) throw upsertError;
          break;
        }
        case 'delete': {
          const { error: deleteError } = await supabase
            .from(validated.tableName)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', validated.recordId);
          if (deleteError) throw deleteError;
          break;
        }
        default: {
          const _exhaustive: never = validated.operationType;
          throw new Error(`Unknown operationType: ${_exhaustive}`);
        }
      }
      result.synced++;
    } catch (err) {
      result.failed++;
      result.errors.push(`Operation ${validated.id}: ${String(err)}`);
    }
  }

  return NextResponse.json(result);
}
