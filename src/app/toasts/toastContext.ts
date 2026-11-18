import { createContext } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export type ToastMessage = {
  id: number;
  message: string;
  kind: ToastKind;
};

export type ToastContextValue = {
  notify: (message: string, kind?: ToastKind, durationMs?: number) => void;
  dismiss: (id: number) => void;
  toasts: ToastMessage[];
};

export const ToastContext = createContext<ToastContextValue | null>(null);
