import { create } from "zustand";

export interface CartItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  unit_price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  branch_id: string | null;
  branch_name: string | null;
  addItem: (item: Omit<CartItem, "id">) => void;
  updateQuantity: (product_id: string, quantity: number) => void;
  removeItem: (product_id: string) => void;
  clear: () => void;
  setBranch: (id: string, name: string) => void;
  getTotal: () => number;
  getCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  branch_id: null,
  branch_name: null,

  addItem: (item) => {
    const existing = get().items.find((i) => i.product_id === item.product_id);
    if (existing) {
      set((s) => ({
        items: s.items.map((i) =>
          i.product_id === item.product_id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        ),
      }));
    } else {
      set((s) => ({ items: [...s.items, item] }));
    }
  },

  updateQuantity: (product_id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(product_id);
      return;
    }
    set((s) => ({
      items: s.items.map((i) =>
        i.product_id === product_id ? { ...i, quantity } : i
      ),
    }));
  },

  removeItem: (product_id) =>
    set((s) => ({ items: s.items.filter((i) => i.product_id !== product_id) })),

  clear: () => set({ items: [], branch_id: null, branch_name: null }),

  setBranch: (id, name) => set({ branch_id: id, branch_name: name }),

  getTotal: () =>
    get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),

  getCount: () =>
    get().items.reduce((sum, i) => sum + i.quantity, 0),
}));
