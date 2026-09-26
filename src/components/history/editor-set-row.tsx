'use client';
import type { Units } from '@/contracts/domain';
import { useT } from '@/lib/i18n/use-t';
import { TrashIcon } from './icons';
import { RIR_OPTIONS, type EditSet } from './edit-model';

interface Props {
  set: EditSet;
  index: number;
  exerciseName: string;
  units: Units;
  error?: { kg?: true; reps?: true };
  onChange: (patch: Partial<EditSet>) => void;
  onRemove: () => void;
}

const field =
  'min-h-11 w-full rounded-lg border bg-bg-2 px-2 text-sm text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-highlight';
const label = 'text-[11px] uppercase tracking-wide text-fg-muted';

function border(bad?: boolean) {
  return bad ? 'border-red-500' : 'border-line';
}

export function EditorSetRow({ set, index, exerciseName, units, error, onChange, onRemove }: Props) {
  const { t } = useT();
  const idp = `set-${set.id}`;
  return (
    <fieldset data-testid="history-edit-set" className="grid grid-cols-2 gap-2 border-t border-line py-2 sm:grid-cols-[1fr_1fr_1fr_1.3fr_auto_auto]">
      <legend className="sr-only">{t('hist_edit_set_group', { name: exerciseName, n: index })}</legend>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idp}-kg`} className={label}>{t('hist_edit_weight', { unit: units })}</label>
        <input
          id={`${idp}-kg`}
          inputMode="decimal"
          value={set.kg}
          aria-invalid={error?.kg ? true : undefined}
          onChange={(e) => onChange({ kg: e.target.value })}
          className={`${field} ${border(error?.kg)}`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idp}-reps`} className={label}>{t('hist_edit_reps')}</label>
        <input
          id={`${idp}-reps`}
          inputMode="numeric"
          value={set.reps}
          aria-invalid={error?.reps ? true : undefined}
          onChange={(e) => onChange({ reps: e.target.value })}
          className={`${field} ${border(error?.reps)}`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idp}-rir`} className={label}>{t('hist_edit_rir')}</label>
        <select id={`${idp}-rir`} value={set.rir} onChange={(e) => onChange({ rir: e.target.value })} className={`${field} border-line`}>
          <option value="">{t('hist_edit_rir_empty')}</option>
          {RIR_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idp}-type`} className={label}>{t('hist_edit_type')}</label>
        <select
          id={`${idp}-type`}
          value={set.type === 'warmup' ? 'warmup' : 'working'}
          onChange={(e) => onChange({ type: e.target.value === 'warmup' ? 'warmup' : 'working' })}
          className={`${field} border-line`}
        >
          <option value="working">{t('hist_edit_type_working')}</option>
          <option value="warmup">{t('hist_edit_type_warmup')}</option>
        </select>
      </div>
      <label htmlFor={`${idp}-done`} className="flex min-h-11 items-center gap-2 self-end text-sm text-fg-2">
        <input
          id={`${idp}-done`}
          type="checkbox"
          checked={set.done}
          onChange={(e) => onChange({ done: e.target.checked })}
          className="h-5 w-5 accent-current focus-visible:ring-2 focus-visible:ring-highlight"
        />
        {t('hist_edit_done')}
      </label>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t('hist_edit_remove_set', { n: index })}
        className="flex min-h-11 min-w-11 items-center justify-center self-end rounded-lg text-fg-muted hover:bg-card-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight"
      >
        <TrashIcon />
      </button>
    </fieldset>
  );
}
