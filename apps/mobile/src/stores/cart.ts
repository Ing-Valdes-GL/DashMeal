import { create } from "zustand";

export interface CartItem {
  id?: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  unit_price: number;
  quantity: number;
}

export interface CartSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  label: string;
}

interface CartState {
  items:        CartItem[];
  branch_id:    string | null;
  branch_name:  string | null;
  order_type:   "collect" | "delivery";
  selected_slot: CartSlot | null;
  promo_id:     string | null;
  promo_code:   string | null;
  promo_pct:    number | null;
  promo_label:  string | null;

  addItem:       (item: Omit<CartItem, "id">) => void;
  updateQuantity:(product_id: string, quantity: number) => void;
  removeItem:    (product_id: string) => void;
  clear:         () => void;
  setBranch:     (id: string, name: string) => void;
  setOrderType:  (type: "collect" | "delivery") => void;
  setSlot:       (slot: CartSlot | null) => void;
  setPromo:      (id: string, code: string, pct: number, label: string | null) => void;
  clearPromo:    () => void;

  getTotal:           () => number;
  getCount:           () => number;
  getDiscount:        () => number;
  getDiscountedTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items:         [],
  branch_id:     null,
  branch_name:   null,
  order_type:    "collect",
  selected_slot: null,
  promo_id:      null,
  promo_code:    null,
  promo_pct:     null,
  promo_label:   null,

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
    if (quantity <= 0) { get().removeItem(product_id); return; }
    set((s) => ({
      items: s.items.map((i) => i.product_id === product_id ? { ...i, quantity } : i),
    }));
  },

  removeItem: (product_id) =>
    set((s) => ({ items: s.items.filter((i) => i.product_id !== product_id) })),

  clear: () => set({
    items: [], branch_id: null, branch_name: null,
    order_type: "collect", selected_slot: null,
    promo_id: null, promo_code: null, promo_pct: null, promo_label: null,
  }),

  setBranch:    (id, name) => set({ branch_id: id, branch_name: name }),
  setOrderType: (type) => set({ order_type: type, selected_slot: null }),
  setSlot:      (slot) => set({ selected_slot: slot }),

  setPromo: (id, code, pct, label) =>
    set({ promo_id: id, promo_code: code, promo_pct: pct, promo_label: label }),

  clearPromo: () =>
    set({ promo_id: null, promo_code: null, promo_pct: null, promo_label: null }),

  getTotal:  () => get().items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0),
  getCount:  () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  getDiscount: () => {
    const pct = get().promo_pct;
    if (!pct) return 0;
    return Math.round(get().getTotal() * pct / 100);
  },

  getDiscountedTotal: () => Math.max(0, get().getTotal() - get().getDiscount()),
}));
