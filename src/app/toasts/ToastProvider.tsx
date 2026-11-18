import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ToastContext, type ToastKind, type ToastMessage } from './toastContext';
import { useToast } from './useToast';
import styles from './toasts.module.css';

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message: string, kind: ToastKind = 'success', durationMs = 4500) => {
    const id = nextId.current + 1;
    nextId.current = id;
    setToasts((current) => [...current, { id, message, kind }]);
    timers.current.set(id, window.setTimeout(() => dismiss(id), durationMs));
  }, [dismiss]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({ dismiss, notify, toasts }), [dismiss, notify, toasts]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function ToastViewport() {
  const { dismiss, toasts } = useToast();
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [toasts.length]);

  return (
    <div
      aria-label={t('toast.notifications')}
      className={styles.viewport}
      ref={viewportRef}
      role="region"
    >
      {toasts.map((toast) => (
        <div
          className={`${styles.toast} ${styles[toast.kind]}`}
          key={toast.id}
          role={toast.kind === 'error' ? 'alert' : 'status'}
        >
          <span aria-hidden="true" className={styles.icon}>
            {toast.kind === 'success' ? '✓' : toast.kind === 'error' ? '!' : 'i'}
          </span>
          <span className={styles.message}>{toast.message}</span>
          <button
            aria-label={t('toast.dismiss')}
            className={styles.dismiss}
            onClick={() => dismiss(toast.id)}
            type="button"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
