import { Component, input, model, output } from '@angular/core';
import { FormValueControl, transformedValue, ValidationError } from '@angular/forms/signals';

/**
 * A labelled `<input type="number">` that binds to a Signal Forms field.
 *
 * Placed as `<numeric-field [formField]="form.someField" label="..." />`. The `FormField`
 * directive keeps `errors`, `min` and `max` in sync with the bound field, so the bounds hint and
 * validation messages come from the field itself.
 */
@Component({
  selector: 'numeric-field',
  templateUrl: './numeric-field.html',
  styleUrl: './numeric-field.scss',
})
export class NumericField implements FormValueControl<number | null> {
  readonly label = input.required<string>();
  readonly value = model<number | null>(null);
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly min = input<number>();
  readonly max = input<number>();
  readonly touch = output<void>();

  /** The text shown in the native input. Parses it back into `value()` and reports parse errors to the field. */
  protected readonly rawValue = transformedValue(this.value, {
    parse: (raw: string) => {
      if (raw.trim() === '') return { value: null };
      const parsed = Number(raw);
      return Number.isNaN(parsed)
        ? { error: { kind: 'parse', message: `${this.label()} must be a number.` } }
        : { value: parsed };
    },
    format: (val: number | null) => val?.toString() ?? '',
  });
}
