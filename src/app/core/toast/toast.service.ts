import { Injectable, Signal, signal } from '@angular/core';
import { Toast, ToastOptions, ToastType } from './toast.types';

const DEFAULT_DURATION_MS: Record<ToastType, number> = {
  success: 3000,
  info: 3000,
  warning: 4000,
  error: 5000,
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsState = signal<Toast[]>([]);
  readonly toasts: Signal<readonly Toast[]> = this.toastsState.asReadonly();

  // Monotonic and never reused, so a stale timer can never dismiss a newer toast.
  private nextId = 1;
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(type: ToastType, message: string, options?: ToastOptions): number {
    const id = this.nextId++;
    this.toastsState.update((list) => [...list, { id, type, message }]);

    const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS[type];
    if (durationMs > 0) {
      this.timers.set(
        id,
        setTimeout(() => this.dismiss(id), durationMs),
      );
    }
    return id;
  }

  success(message: string, options?: ToastOptions): number {
    return this.show('success', message, options);
  }

  error(message: string, options?: ToastOptions): number {
    return this.show('error', message, options);
  }

  info(message: string, options?: ToastOptions): number {
    return this.show('info', message, options);
  }

  warning(message: string, options?: ToastOptions): number {
    return this.show('warning', message, options);
  }

  dismiss(id: number): void {
    this.clearTimer(id);
    this.toastsState.update((list) => list.filter((t) => t.id !== id));
  }

  clear(): void {
    this.timers.forEach((handle) => clearTimeout(handle));
    this.timers.clear();
    this.toastsState.set([]);
  }

  private clearTimer(id: number): void {
    const handle = this.timers.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      this.timers.delete(id);
    }
  }
}
