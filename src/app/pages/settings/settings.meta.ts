import { max, min, required, validate, PathKind, SchemaPath, SchemaPathRules } from '@angular/forms/signals';

/** True for a real number, as opposed to the `null`/`NaN` an emptied number input writes. */
export function isNumeric(value: number | null): value is number {
  return value !== null && !Number.isNaN(value);
}

/** Binds required/min/max/whole-number validators for one integer field, sharing `label` and `bounds` in their messages. */
export function validateIntegerField<TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<number, SchemaPathRules.Supported, TPathKind>,
  label: string,
  bounds: { min: number; max: number },
): void {
  required(path, { message: `${label} is required.` });

  const rangeMessage = `${label} must be between ${bounds.min} and ${bounds.max}.`;
  min(path, bounds.min, { when: (ctx) => isNumeric(ctx.value() as number | null), message: rangeMessage });
  max(path, bounds.max, { when: (ctx) => isNumeric(ctx.value() as number | null), message: rangeMessage });

  validate(path, (ctx) => {
    const value = ctx.value() as number | null;
    if (!isNumeric(value) || Number.isInteger(value)) return undefined;
    return { kind: 'wholeNumber', message: `${label} must be a whole number.` };
  });
}
