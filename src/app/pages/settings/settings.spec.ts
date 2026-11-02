import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarketService } from '../../core/market.service';
import { DEFAULT_SETTINGS } from '../../core/settings';
import { MarketState } from '../../core/market.types';
import { createFakeMarketService } from '../../core/testing/fake-market-service';
import { ToastService } from '../../core/toast/toast.service';
import { Settings } from './settings';

function createFakeToastService() {
  return {
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
    clear: vi.fn(),
    toasts: () => [],
  };
}

describe('Settings', () => {
  let fixture: ComponentFixture<Settings>;
  let component: Settings;
  let fakeMarketService: ReturnType<typeof createFakeMarketService>;
  let fakeToastService: ReturnType<typeof createFakeToastService>;
  let host: HTMLElement;

  beforeEach(async () => {
    fakeMarketService = createFakeMarketService();
    fakeToastService = createFakeToastService();

    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        { provide: MarketService, useValue: fakeMarketService },
        { provide: ToastService, useValue: fakeToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  function submitButton(): HTMLButtonElement {
    const button = host.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!button) throw new Error('Apply button not rendered');
    return button;
  }

  it('starts with the form holding DEFAULT_SETTINGS and a valid state', () => {
    expect(component.form().value()).toEqual(DEFAULT_SETTINGS);
    expect(component.isValid()).toBe(true);
  });

  it('enables the Apply button when the defaults are valid', () => {
    expect(submitButton().hasAttribute('disabled')).toBe(false);
  });

  // Clearing a native <input type="number"> writes `null` to the model (verified empirically),
  // which TypeScript types as `number | null` only at runtime. These casts mirror that real
  // browser behavior; the field validators treat null and NaN as "required".
  describe('instrumentCount', () => {
    it('accepts the minimum boundary (1)', () => {
      component.form.instrumentCount().value.set(1);
      fixture.detectChanges();
      expect(component.isValid()).toBe(true);
    });

    it('rejects just below the minimum (0)', () => {
      component.form.instrumentCount().value.set(0);
      fixture.detectChanges();

      expect(component.isValid()).toBe(false);
      expect(submitButton().hasAttribute('disabled')).toBe(true);
      expect(host.textContent).toContain('Instrument count must be between 1 and 50.');
    });

    it('accepts the maximum boundary (50)', () => {
      component.form.instrumentCount().value.set(50);
      fixture.detectChanges();
      expect(component.isValid()).toBe(true);
    });

    it('rejects just above the maximum (51)', () => {
      component.form.instrumentCount().value.set(51);
      fixture.detectChanges();
      expect(host.textContent).toContain('Instrument count must be between 1 and 50.');
    });

    it('rejects fractional values (5.5)', () => {
      component.form.instrumentCount().value.set(5.5);
      fixture.detectChanges();
      expect(host.textContent).toContain('Instrument count must be a whole number.');
    });

    it('rejects NaN', () => {
      component.form.instrumentCount().value.set(NaN);
      fixture.detectChanges();
      expect(host.textContent).toContain('Instrument count is required.');
    });

    it('rejects an empty value', () => {
      component.form.instrumentCount().value.set(null as unknown as number);
      fixture.detectChanges();
      expect(host.textContent).toContain('Instrument count is required.');
    });
  });

  describe('updatesPerBatch', () => {
    it('accepts the minimum boundary (1)', () => {
      component.form.updatesPerBatch().value.set(1);
      fixture.detectChanges();
      expect(component.isValid()).toBe(true);
    });

    it('rejects just below the minimum (0)', () => {
      component.form.updatesPerBatch().value.set(0);
      fixture.detectChanges();
      expect(host.textContent).toContain('Updates per batch must be between 1 and 1000.');
    });

    it('accepts the maximum boundary (1000)', () => {
      component.form.updatesPerBatch().value.set(1000);
      fixture.detectChanges();
      expect(component.isValid()).toBe(true);
    });

    it('rejects just above the maximum (1001)', () => {
      component.form.updatesPerBatch().value.set(1001);
      fixture.detectChanges();
      expect(host.textContent).toContain('Updates per batch must be between 1 and 1000.');
    });

    it('shows a required error and disables Apply for an empty value', () => {
      component.form.updatesPerBatch().value.set(null as unknown as number);
      fixture.detectChanges();

      expect(host.textContent).toContain('Updates per batch is required.');
      expect(submitButton().hasAttribute('disabled')).toBe(true);
    });
  });

  describe('batchIntervalMs', () => {
    it('accepts the minimum boundary (50)', () => {
      component.form.batchIntervalMs().value.set(50);
      fixture.detectChanges();
      expect(component.isValid()).toBe(true);
    });

    it('rejects just below the minimum (49)', () => {
      component.form.batchIntervalMs().value.set(49);
      fixture.detectChanges();
      expect(host.textContent).toContain('Batch interval (ms) must be between 50 and 2000.');
    });

    it('accepts the maximum boundary (2000)', () => {
      component.form.batchIntervalMs().value.set(2000);
      fixture.detectChanges();
      expect(component.isValid()).toBe(true);
    });

    it('rejects just above the maximum (2001)', () => {
      component.form.batchIntervalMs().value.set(2001);
      fixture.detectChanges();
      expect(host.textContent).toContain('Batch interval (ms) must be between 50 and 2000.');
    });

    it('shows a whole-number error for a fractional value', () => {
      component.form.batchIntervalMs().value.set(500.5);
      fixture.detectChanges();

      expect(host.textContent).toContain('Batch interval (ms) must be a whole number.');
      expect(component.isValid()).toBe(false);
    });
  });

  it('does not call MarketService.apply() while the draft is edited', () => {
    component.form.instrumentCount().value.set(10);
    fixture.detectChanges();
    component.form.updatesPerBatch().value.set(0);
    fixture.detectChanges();

    expect(fakeMarketService.apply).not.toHaveBeenCalled();
  });

  it('calls MarketService.apply() once with numeric settings when the form is valid', () => {
    component.form.instrumentCount().value.set(10);
    component.form.updatesPerBatch().value.set(200);
    component.form.batchIntervalMs().value.set(1000);
    fixture.detectChanges();

    component.apply();

    expect(fakeMarketService.apply).toHaveBeenCalledTimes(1);
    const call = fakeMarketService.apply.mock.calls[0][0];
    expect(call).toEqual({ instrumentCount: 10, updatesPerBatch: 200, batchIntervalMs: 1000 });
    expect(typeof call.instrumentCount).toBe('number');
    expect(typeof call.updatesPerBatch).toBe('number');
    expect(typeof call.batchIntervalMs).toBe('number');
  });

  it('does not call MarketService.apply() when the form is invalid', () => {
    component.form.instrumentCount().value.set(0);
    fixture.detectChanges();

    component.apply();

    expect(fakeMarketService.apply).not.toHaveBeenCalled();
  });

  describe('range hints', () => {
    it('shows the instrument count bound (1–50)', () => {
      expect(host.textContent).toContain('(1–50)');
    });

    it('shows the updates per batch bound (1–1000)', () => {
      expect(host.textContent).toContain('(1–1000)');
    });

    it('shows the batch interval bound (50–2000)', () => {
      expect(host.textContent).toContain('(50–2000)');
    });
  });

  describe('toast notifications', () => {
    function setValidValuesAndApply(): void {
      component.form.instrumentCount().value.set(10);
      component.form.updatesPerBatch().value.set(200);
      component.form.batchIntervalMs().value.set(1000);
      fixture.detectChanges();
      component.apply();
      fixture.detectChanges();
    }

    it('shows no toast initially', () => {
      expect(fakeToastService.success).not.toHaveBeenCalled();
      expect(fakeToastService.error).not.toHaveBeenCalled();
    });

    it('shows a success toast after a successful Apply', () => {
      setValidValuesAndApply();

      expect(fakeToastService.success).toHaveBeenCalledTimes(1);
      expect(fakeToastService.success).toHaveBeenCalledWith('Settings applied — new run started.');
      expect(fakeToastService.error).not.toHaveBeenCalled();
    });

    it('switches to an error toast when the watched run fails', () => {
      setValidValuesAndApply();

      fakeMarketService.setState({
        status: 'error',
        activeRunId: 1,
        settings: DEFAULT_SETTINGS,
        instruments: [],
        error: 'WASM producer aborted',
      });
      fixture.detectChanges();

      expect(fakeToastService.error).toHaveBeenCalledTimes(1);
      expect(fakeToastService.error).toHaveBeenCalledWith('WASM producer aborted');
    });

    it('ignores an error for a different run id', () => {
      setValidValuesAndApply();

      fakeMarketService.setState({
        status: 'error',
        activeRunId: 999,
        settings: DEFAULT_SETTINGS,
        instruments: [],
        error: 'unrelated failure',
      });
      fixture.detectChanges();

      expect(fakeToastService.error).not.toHaveBeenCalled();
      expect(fakeToastService.success).toHaveBeenCalledWith('Settings applied — new run started.');
    });
  });
});
