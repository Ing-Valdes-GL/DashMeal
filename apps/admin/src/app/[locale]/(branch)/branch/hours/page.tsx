"use client";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { branchApiGet, branchApiPut, branchApiPatch } from "@/lib/branch-api";
import { useBranchAuthStore } from "@/stores/branch-auth";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Save } from "lucide-react";

interface DayHour {
  id?: string;
  day_of_week: number; // 0 = Sunday, 1 = Monday, …, 6 = Saturday
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

const DAY_LABELS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const ORDERED_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

const DEFAULT_HOURS: DayHour[] = ORDERED_DAYS.map((d) => ({
  day_of_week: d,
  open_time: "08:00",
  close_time: "22:00",
  is_closed: d === 0, // Sunday closed by default
}));

export default function BranchHoursPage() {
  const { manager } = useBranchAuthStore();
  const qc = useQueryClient();
  const branchId = manager?.branch_id;

  const [hours, setHours] = useState<DayHour[]>(DEFAULT_HOURS);
  const [dirty, setDirty] = useState(false);

  const { data: fetchedHours, isLoading } = useQuery<DayHour[]>({
    queryKey: ["branch-hours", branchId],
    queryFn:  () => branchApiGet(`/branch-hours/${branchId}`),
    enabled:  !!branchId,
    select: (d: any) => Array.isArray(d) ? d : d?.data ?? [],
  });

  useEffect(() => {
    if (fetchedHours && fetchedHours.length > 0) {
      // Merge fetched data into the ordered structure
      const merged = ORDERED_DAYS.map((day) => {
        const found = fetchedHours.find((h) => h.day_of_week === day);
        return found ?? { day_of_week: day, open_time: "08:00", close_time: "22:00", is_closed: day === 0 };
      });
      setHours(merged);
    }
  }, [fetchedHours]);

  const saveMutation = useMutation({
    mutationFn: () => branchApiPut(`/branch-hours/${branchId}`, { hours }),
    onSuccess: () => {
      toast.success("Horaires sauvegardés");
      qc.invalidateQueries({ queryKey: ["branch-hours"] });
      setDirty(false);
    },
    onError: () => toast.error("Sauvegarde échouée"),
  });

  const toggleDay = (dayIndex: number) => {
    setHours((prev) =>
      prev.map((h) => h.day_of_week === ORDERED_DAYS[dayIndex] ? { ...h, is_closed: !h.is_closed } : h)
    );
    setDirty(true);
  };

  const updateTime = (dayIndex: number, field: "open_time" | "close_time", value: string) => {
    setHours((prev) =>
      prev.map((h) => h.day_of_week === ORDERED_DAYS[dayIndex] ? { ...h, [field]: value } : h)
    );
    setDirty(true);
  };

  const applyToAll = (source: DayHour) => {
    setHours((prev) =>
      prev.map((h) => ({ ...h, open_time: source.open_time, close_time: source.close_time }))
    );
    toast.success("Horaires copiés sur tous les jours");
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Horaires d'ouverture</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configurez les horaires de votre agence</p>
        </div>
        <Button
          className="bg-brand-600 hover:bg-brand-700 gap-2"
          disabled={!dirty || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Clock className="h-4 w-4 text-brand-600" />
            Planning hebdomadaire
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : (
            ORDERED_DAYS.map((day, index) => {
              const h = hours[index];
              if (!h) return null;
              return (
                <div
                  key={day}
                  className={`rounded-xl border px-4 py-3 transition-colors ${h.is_closed ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200"}`}
                >
                  <div className="flex items-center gap-4">
                    {/* Day label + toggle */}
                    <div className="flex items-center gap-3 w-36 shrink-0">
                      <Switch
                        checked={!h.is_closed}
                        onCheckedChange={() => toggleDay(index)}
                      />
                      <span className={`text-sm font-semibold ${h.is_closed ? "text-slate-400" : "text-slate-800"}`}>
                        {DAY_LABELS[day]}
                      </span>
                    </div>

                    {/* Time pickers */}
                    {h.is_closed ? (
                      <span className="text-sm text-slate-400 italic">Fermé</span>
                    ) : (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          type="time"
                          value={h.open_time}
                          onChange={(e) => updateTime(index, "open_time", e.target.value)}
                          className="w-32 text-sm"
                        />
                        <span className="text-slate-400 text-sm">→</span>
                        <Input
                          type="time"
                          value={h.close_time}
                          onChange={(e) => updateTime(index, "close_time", e.target.value)}
                          className="w-32 text-sm"
                        />
                        <button
                          onClick={() => applyToAll(h)}
                          className="text-xs text-brand-600 hover:text-brand-700 font-medium underline ml-2 whitespace-nowrap"
                        >
                          Appliquer à tous
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-brand-50 border-brand-100">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-brand-700 uppercase tracking-wider mb-2">Résumé</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {ORDERED_DAYS.map((day, index) => {
              const h = hours[index];
              if (!h) return null;
              return (
                <div key={day} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{DAY_LABELS[day]}</span>
                  <span className={`font-medium ${h.is_closed ? "text-red-500" : "text-slate-800"}`}>
                    {h.is_closed ? "Fermé" : `${h.open_time} – ${h.close_time}`}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
