import { useState, useEffect } from "react";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | "success";
}

type ToastListener = (toasts: Toast[]) => void;
let memoryToasts: Toast[] = [];
let listeners: ToastListener[] = [];

const genId = () => Math.random().toString(36).substring(2, 9);

const notify = () => {
  listeners.forEach((listener) => listener([...memoryToasts]));
};

export function toast({ title, description, variant = "default" }: Omit<Toast, "id">) {
  const id = genId();
  const newToast: Toast = { id, title, description, variant };
  memoryToasts = [...memoryToasts, newToast];
  notify();

  // Auto dismiss after 3 seconds
  setTimeout(() => {
    memoryToasts = memoryToasts.filter((t) => t.id !== id);
    notify();
  }, 4000);

  return {
    id,
    dismiss: () => {
      memoryToasts = memoryToasts.filter((t) => t.id !== id);
      notify();
    },
  };
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(memoryToasts);

  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setToasts(newToasts);
    };
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    toasts,
    toast,
  };
}
