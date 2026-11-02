import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    service.clear();
    vi.useRealTimers();
  });

  it('show() adds a toast and returns a numeric id', () => {
    const id = service.show('info', 'hello');

    expect(typeof id).toBe('number');
    expect(service.toasts()).toEqual([{ id, type: 'info', message: 'hello' }]);
  });

  it('convenience methods set the matching type', () => {
    service.success('a');
    service.error('b');
    service.info('c');
    service.warning('d');

    expect(service.toasts().map((t) => t.type)).toEqual(['success', 'error', 'info', 'warning']);
  });

  it('dismiss(id) removes exactly that toast', () => {
    const first = service.info('first');
    const second = service.info('second');

    service.dismiss(first);

    expect(service.toasts().map((t) => t.id)).toEqual([second]);
  });

  it('dismiss() with an unknown id is a no-op', () => {
    service.info('only');

    expect(() => service.dismiss(9999)).not.toThrow();
    expect(service.toasts()).toHaveLength(1);
  });

  it('auto-dismisses after the default duration', () => {
    vi.useFakeTimers();
    service.success('saved');

    vi.advanceTimersByTime(2999);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('uses the longer default duration for error toasts', () => {
    vi.useFakeTimers();
    service.error('boom');

    vi.advanceTimersByTime(4999);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('durationMs: 0 keeps the toast past any default duration', () => {
    vi.useFakeTimers();
    service.info('sticky', { durationMs: 0 });

    vi.advanceTimersByTime(60_000);

    expect(service.toasts()).toHaveLength(1);
  });

  it('clear() empties the list and cancels pending timers', () => {
    vi.useFakeTimers();
    service.info('a');
    service.error('b');

    service.clear();
    expect(service.toasts()).toEqual([]);

    expect(() => vi.advanceTimersByTime(10_000)).not.toThrow();
    expect(service.toasts()).toEqual([]);
  });

  it('ids are never reused after dismissal', () => {
    const first = service.info('a');
    service.dismiss(first);
    const second = service.info('b');

    expect(second).not.toBe(first);
  });
});
