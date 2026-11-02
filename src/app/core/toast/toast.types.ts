export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  readonly id: number;
  readonly type: ToastType;
  readonly message: string;
}

export interface ToastOptions {
  /** ms until auto-dismiss. 0 means it stays until dismissed manually. */
  readonly durationMs?: number;
}
