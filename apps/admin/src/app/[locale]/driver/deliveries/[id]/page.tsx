"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type DeliveryStatus = "pending" | "accepted" | "picking_up" | "delivering" | "delivered";

interface DeliveryDetail {
  id: string;
  order_number: string;
  status: DeliveryStatus;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  distance_km: number;
  amount: number;
  commission: number;
  branch_name: string;
  branch_address: string;
  branch_phone?: string;
  items: { name: string; quantity: number; price: number }[];
  notes?: string;
  created_at: string;
}

function getToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.match(/dm_driver_access_token=([^;]+)/)?.[1] ?? "";
}

const NEXT_STATUS: Record<DeliveryStatus, { label: string; next: DeliveryStatus | null }> = {
  pending:    { label: "Accepter la livraison", next: "accepted" },
  accepted:   { label: "Je suis en route pour récupérer", next: "picking_up" },
  picking_up: { label: "J'ai récupéré la commande", next: "delivering" },
  delivering: { label: "Livraison effectuée ✓", next: "delivered" },
  delivered:  { label: "Livré", next: null },
};

function formatCFA(n: number) { return n.toLocaleString("fr-FR") + " F"; }

export default function DeliveryDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id, locale } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showItems, setShowItems] = useState(false);

  const { data: delivery, isLoading } = useQuery<DeliveryDetail>({
    queryKey: ["driver-delivery", id],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/driver/deliveries/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const body = await res.json();
      return body.data;
    },
    refetchInterval: 30_000,
  });

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: async (next: DeliveryStatus) => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/driver/deliveries/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["driver-delivery", id] });
      queryClient.invalidateQueries({ queryKey: ["driver-deliveries"] });
      if (delivery && NEXT_STATUS[delivery.status].next === "delivered") {
        router.push(`/${locale}/driver/deliveries`);
      }
    },
  });

  if (isLoading || !delivery) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nextCfg = NEXT_STATUS[delivery.status];
  const mapsUrl = delivery.delivery_lat && delivery.delivery_lng
    ? `https://maps.google.com/?q=${delivery.delivery_lat},${delivery.delivery_lng}`
    : `https://maps.google.com/?q=${encodeURIComponent(delivery.delivery_address)}`;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        Retour
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-800 font-bold">Commande #{delivery.order_number}</span>
          <span className="text-orange-500 font-bold text-lg">{formatCFA(delivery.commission)}</span>
        </div>
        <p className="text-slate-400 text-xs">{delivery.distance_km} km · {delivery.items.length} article{delivery.items.length > 1 ? "s" : ""}</p>

        {/* Progress dots */}
        <div className="flex items-center justify-between mt-4">
          {(["pending","accepted","picking_up","delivering","delivered"] as DeliveryStatus[]).map((s, i) => {
            const steps = ["pending","accepted","picking_up","delivering","delivered"] as DeliveryStatus[];
            const curIdx = steps.indexOf(delivery.status);
            const done = i <= curIdx;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${done ? "bg-orange-500" : "bg-slate-200"}`} />
                {i < 4 && <div className={`flex-1 h-0.5 ${i < curIdx ? "bg-orange-500" : "bg-slate-200"}`} />}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1">
          {["Nouveau","Accepté","Récupération","Livraison","Livré"].map((l) => (
            <span key={l} className="text-[9px] text-slate-400 text-center" style={{ flex: 1 }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Route */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
        <h2 className="text-slate-800 font-bold text-sm">Itinéraire</h2>

        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-orange-500" />
            </div>
            <div className="w-0.5 h-6 bg-slate-200 my-1" />
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
          </div>
          <div className="flex flex-col gap-4 flex-1 pt-0.5">
            <div>
              <p className="text-xs text-slate-400">Récupérer chez</p>
              <p className="font-semibold text-slate-700 text-sm">{delivery.branch_name}</p>
              <p className="text-xs text-slate-500">{delivery.branch_address}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Livrer à</p>
              <p className="font-semibold text-slate-700 text-sm">{delivery.customer_name}</p>
              <p className="text-xs text-slate-500">{delivery.delivery_address}</p>
            </div>
          </div>
        </div>

        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full border border-blue-200 bg-blue-50 text-blue-600 font-semibold text-sm py-3 rounded-xl"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          Ouvrir dans Maps
        </a>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <h2 className="text-slate-800 font-bold text-sm mb-3">Contacts</h2>
        <div className="space-y-2">
          <a href={`tel:${delivery.customer_phone}`} className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs text-slate-400">Client</p>
              <p className="text-sm font-semibold text-slate-700">{delivery.customer_name}</p>
            </div>
            <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.6 1.1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.7a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
          </a>
          {delivery.branch_phone && (
            <a href={`tel:${delivery.branch_phone}`} className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-xl">
              <div>
                <p className="text-xs text-slate-400">Boutique</p>
                <p className="text-sm font-semibold text-slate-700">{delivery.branch_name}</p>
              </div>
              <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11.9 19.79 19.79 0 0 1 1.61 3.27 2 2 0 0 1 3.6 1.1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.7a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </div>
            </a>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowItems(!showItems)}
          className="w-full flex items-center justify-between p-4 text-sm font-bold text-slate-800"
        >
          <span>Articles ({delivery.items.length})</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ transform: showItems ? "rotate(180deg)" : undefined }}>
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
        {showItems && (
          <div className="border-t border-slate-100 divide-y divide-slate-50">
            {delivery.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-700 text-sm">{item.quantity}× {item.name}</span>
                <span className="text-slate-500 text-xs">{formatCFA(item.price)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50">
              <span className="text-slate-800 font-bold text-sm">Total commande</span>
              <span className="text-slate-800 font-bold text-sm">{formatCFA(delivery.amount)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      {delivery.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-amber-700 mb-1">Note du client</p>
          <p className="text-sm text-amber-800">{delivery.notes}</p>
        </div>
      )}

      {/* CTA */}
      {nextCfg.next && (
        <button
          onClick={() => updateStatus(nextCfg.next!)}
          disabled={isPending}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl text-base transition-colors disabled:opacity-50 shadow-lg shadow-orange-500/25"
        >
          {isPending ? "Mise à jour…" : nextCfg.label}
        </button>
      )}

      {delivery.status === "delivered" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
          <p className="text-emerald-700 font-bold">Livraison terminée ✓</p>
          <p className="text-emerald-600 text-sm">Commission : {formatCFA(delivery.commission)}</p>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
