import { z } from "zod";

export const AddToCartSchema = z.object({
  branch_id: z.string().uuid(),
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().optional(),
  quantity: z.number().int().positive(),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().min(0), // 0 = supprimer
});

export const CreateCollectOrderSchema = z.object({
  branch_id: z.string().uuid(),
  slot_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
  promotion_code: z.string().optional(),
});

export const CreateDeliveryOrderSchema = z.object({
  branch_id: z.string().uuid(),
  delivery_address: z.string().min(5).max(500),
  delivery_lat: z.number(),
  delivery_lng: z.number(),
  notes: z.string().max(500).optional(),
  promotion_code: z.string().optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    "confirmed",
    "preparing",
    "ready",
    "delivering",
    "delivered",
    "cancelled",
  ]),
  note: z.string().max(500).optional(),
});

export const AssignDriverSchema = z.object({
  driver_id: z.string().uuid(),
});

export const CreateTimeSlotSchema = z.object({
  branch_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.number().int().positive(),
});

export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof UpdateCartItemSchema>;
export type CreateCollectOrderInput = z.infer<typeof CreateCollectOrderSchema>;
export type CreateDeliveryOrderInput = z.infer<typeof CreateDeliveryOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof UpdateOrderStatusSchema>;
export type AssignDriverInput = z.infer<typeof AssignDriverSchema>;
export type CreateTimeSlotInput = z.infer<typeof CreateTimeSlotSchema>;
