"use client";
import { create } from "zustand";

export type ToastVariant = "default" | "success" | "destructive" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID();
    const duration = toast.duration ?? 4000;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Fonction utilitaire utilisable depuis n'importe quel fichier
export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().addToast({ title, description, variant: "success" }),
  error: (title: string, description?: string) =>
    useToastStore.getState().addToast({ title, description, variant: "destructive" }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().addToast({ title, description, variant: "warning" }),
  info: (title: string, description?: string) =>
    useToastStore.getState().addToast({ title, description, variant: "info" }),
  message: (title: string, description?: string) =>
    useToastStore.getState().addToast({ title, description, variant: "default" }),
};
