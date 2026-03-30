import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import type { SyncOperation } from '@/types/sync';

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

/**
 * POST /api/sync
 * Server-side sync trigger: validates and executes a batch of SyncOperations
 * against Supabase on behalf of the authenticated user.
 *
 * Body: { operations: SyncOperation[] }
 * Response: { synced: number, failed: number, errors: string[] }
 */
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
    // Validate table is allowed
    if (!ALLOWED_TABLES.has(op.tableName)) {
      result.failed++;
      result.errors.push(`Operation ${op.id}: table "${op.tableName}" is not allowed`);
      continue;
    }

    try {
      switch (op.operationType) {
        case 'create':
        case 'update':
          await supabase.from(op.tableName).upsert(op.payload);
          break;
        case 'delete':
          await supabase
            .from(op.tableName)
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', op.recordId);
          break;
        default: {
          const _exhaustive: never = op.operationType;
          throw new Error(`Unknown operationType: ${_exhaustive}`);
        }
      }
      result.synced++;
    } catch (err) {
      result.failed++;
      result.errors.push(`Operation ${op.id}: ${String(err)}`);
    }
  }

  return NextResponse.json(result);
}
