import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { NumericField } from './numeric-field';

describe('NumericField', () => {
  let fixture: ComponentFixture<NumericField>;
  let component: NumericField;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NumericField] }).compileComponents();

    fixture = TestBed.createComponent(NumericField);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('label', 'Instrument count');
    fixture.componentRef.setInput('value', 5);
    fixture.detectChanges();
  });

  function input(): HTMLInputElement {
    const el = host.querySelector<HTMLInputElement>('input[type="number"]');
    if (!el) throw new Error('number input not rendered');
    return el;
  }

  function typeText(text: string): void {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('renders the label text', () => {
    expect(host.querySelector('label')?.textContent).toContain('Instrument count');
  });

  it('shows the current value in the input', () => {
    expect(input().value).toBe('5');
  });

  it('renders the min–max hint only when both min and max are set', () => {
    expect(host.querySelector('.hint')).toBeNull();

    fixture.componentRef.setInput('min', 1);
    fixture.detectChanges();
    expect(host.querySelector('.hint')).toBeNull();

    fixture.componentRef.setInput('max', 50);
    fixture.detectChanges();
    expect(host.querySelector('.hint')?.textContent).toContain('(1–50)');
  });

  it('renders validation errors passed via the errors input', () => {
    fixture.componentRef.setInput('errors', [{ kind: 'required', message: 'Instrument count is required.' }]);
    fixture.detectChanges();

    const errors = host.querySelectorAll('.field-error');
    expect(errors).toHaveLength(1);
    expect(errors[0].textContent).toContain('Instrument count is required.');
  });

  it('updates value() when a valid number is typed', () => {
    typeText('42');

    expect(component.value()).toBe(42);
  });

  it('writes null to value() when the input is cleared', () => {
    typeText('');

    expect(component.value()).toBeNull();
  });

  it('blur emits touch', () => {
    const spy = vi.fn();
    component.touch.subscribe(spy);

    input().dispatchEvent(new Event('blur'));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

@Component({
  selector: 'numeric-field-host',
  imports: [NumericField, FormField],
  template: `<numeric-field [formField]="f.count" label="Count" />`,
})
class NumericFieldHost {
  readonly model = signal<{ count: number | null }>({ count: 5 });
  readonly f = form(this.model);
}

describe('NumericField bound through [formField]', () => {
  let fixture: ComponentFixture<NumericFieldHost>;
  let host: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NumericFieldHost] }).compileComponents();

    fixture = TestBed.createComponent(NumericFieldHost);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function input(): HTMLInputElement {
    const el = host.querySelector<HTMLInputElement>('input[type="number"]');
    if (!el) throw new Error('number input not rendered');
    return el;
  }

  it('surfaces a parse error and leaves the model unchanged for non-numeric text', () => {
    // A real <input type="number"> sanitizes non-numeric text to '', so simulate a raw value that
    // reaches the handler without going through the browser's sanitization.
    Object.defineProperty(input(), 'value', { configurable: true, get: () => 'abc', set: () => undefined });
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.model().count).toBe(5);
    expect(host.textContent).toContain('Count must be a number.');
  });

  it('pushes a typed number into the bound field', () => {
    input().value = '17';
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.model().count).toBe(17);
  });
});
