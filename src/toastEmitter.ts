import EventEmitter from 'eventemitter3';

const toastEmitter = new EventEmitter();
const TOAST_EVENT = 'toast';

type ToastType = 'success' | 'warning' | 'error';

interface ToastOptions {
  title?: string;
  message: string;
  duration?: number;
}

interface ToastPayload extends ToastOptions {
  type: ToastType;
  duration: number;
}

const emit = (payload: ToastPayload) => toastEmitter.emit(TOAST_EVENT, payload);

export const showSuccess = (options: ToastOptions) =>
  emit({ type: 'success', duration: 4000, ...options });

export const showError = (options: ToastOptions) =>
  emit({ type: 'error', duration: 4000, ...options });

export const showWarning = (options: ToastOptions) =>
  emit({ type: 'warning', duration: 4000, ...options });

export { toastEmitter, TOAST_EVENT };
