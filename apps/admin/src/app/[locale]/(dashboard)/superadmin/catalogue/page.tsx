"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { apiGet } from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Search, MapPin, Navigation, Navigation2, Building2,
  RefreshCw, AlertCircle, Package, ChevronDown, ChevronUp,
  Store, Star, Wifi, WifiOff,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeaturedProduct {
  id: string;
  name: string;
  name_fr: string | null;
  price: number;
  image_url: string | null;
}

interface BranchData {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  is_active: boolean;
  is_live: boolean;
  category: string;
  image_url: string | null;
  phone: string | null;
  distance_km?: number | null;
}

interface CatalogueBrand {
  id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  created_at: string;
  branches: BranchData[];
  featured_products: FeaturedProduct[];
}

interface GeoState {
  lat: number | null;
  lng: number | null;
  loading: boolean;
  error: string | null;
}

// ─── Haversine (distance entre deux points GPS en km) ────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `à ${km.toFixed(1)} km`;
}

function sortBranchesByDistance(
  branches: BranchData[],
  userLat: number | null,
  userLng: number | null,
): BranchData[] {
  if (userLat === null || userLng === null) return branches;

  return [...branches]
    .map((b) => ({
      ...b,
      distance_km:
        b.lat != null && b.lng != null
          ? haversineKm(userLat, userLng, b.lat, b.lng)
          : null,
    }))
    .sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return 0;
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });
}

// ─── Catégories / badges ──────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  restaurant: {
    label: "Restaurant",
    bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-400",
  },
  supermarket: {
    label: "Supermarché",
    bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-400",
  },
  superette: {
    label: "Supérette",
    bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-400",
  },
  cafe: {
    label: "Café",
    bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-400",
  },
  bakery: {
    label: "Boulangerie",
    bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", dot: "bg-yellow-400",
  },
  pharmacy: {
    label: "Pharmacie",
    bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-400",
  },
  other: {
    label: "Autre",
    bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400",
  },
};

function getPrimaryCategory(branches: BranchData[]): string {
  if (!branches.length) return "other";
  const counts: Record<string, number> = {};
  for (const b of branches) counts[b.category] = (counts[b.category] ?? 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Skeleton Brand Card ──────────────────────────────────────────────────────

function BrandCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-4 p-5 border-b border-slate-50">
        <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20 rounded-full" />
        </div>
        <Skeleton className="h-5 w-10 rounded-full" />
      </div>
      {/* products */}
      <div className="p-5 space-y-3">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shrink-0 w-24 space-y-1.5">
              <Skeleton className="w-24 h-20 rounded-xl" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      </div>
      {/* branches */}
      <div className="border-t border-slate-50 p-5 space-y-3">
        <Skeleton className="h-3 w-28" />
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-24" />
            </div>
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Branch Row ───────────────────────────────────────────────────────────────

function BranchRow({ branch, geoAvailable }: { branch: BranchData; geoAvailable: boolean }) {
  const cat = CATEGORY_CONFIG[branch.category] ?? CATEGORY_CONFIG.other;

  return (
    <div className="flex items-center gap-3 py-2.5 group">
      {/* icône agence */}
      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors",
        branch.is_live ? "bg-green-50" : "bg-slate-50",
      )}>
        <Store className={cn("w-4 h-4", branch.is_live ? "text-green-500" : "text-slate-400")} />
      </div>

      {/* infos */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{branch.name}</p>
        {(branch.address || branch.city) && (
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {[branch.address, branch.city].filter(Boolean).join(", ")}
          </p>
        )}
      </div>

      {/* statut live */}
      <div className={cn(
        "shrink-0 w-1.5 h-1.5 rounded-full",
        branch.is_live ? "bg-green-400" : "bg-slate-300",
      )} />

      {/* distance */}
      {geoAvailable && (
        <div className="shrink-0 flex items-center gap-1 text-xs font-medium text-slate-500">
          <MapPin className="w-3 h-3 text-brand-500" />
          {branch.distance_km != null
            ? formatDistance(branch.distance_km)
            : <span className="text-slate-300">—</span>}
        </div>
      )}
    </div>
  );
}

// ─── Brand Card ───────────────────────────────────────────────────────────────

function BrandCard({
  brand,
  userLat,
  userLng,
  geoAvailable,
}: {
  brand: CatalogueBrand;
  userLat: number | null;
  userLng: number | null;
  geoAvailable: boolean;
}) {
  const [branchesExpanded, setBranchesExpanded] = useState(false);
  const primaryCategory = getPrimaryCategory(brand.branches);
  const cat = CATEGORY_CONFIG[primaryCategory] ?? CATEGORY_CONFIG.other;
  const sortedBranches = sortBranchesByDistance(brand.branches, userLat, userLng);
  const visibleBranches = branchesExpanded ? sortedBranches : sortedBranches.slice(0, 3);
  const hasMoreBranches = sortedBranches.length > 3;
  const initials = getInitials(brand.name);

  return (
    <div className="group bg-white rounded-2xl border border-slate-100 shadow-[0_2px_16px_0_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.10)] hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col">

      {/* ── Header Marque ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-slate-50">
        {/* Logo */}
        <div className="relative shrink-0">
          {brand.logo_url ? (
            <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
              <Image
                src={brand.logo_url}
                alt={brand.name}
                width={56}
                height={56}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center border border-brand-100 shadow-sm">
              <span className="text-lg font-bold text-brand-600 tracking-tight">{initials}</span>
            </div>
          )}
          {/* indicateur actif */}
          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full shadow-sm" />
        </div>

        {/* Nom + badge catégorie */}
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 truncate leading-tight">{brand.name}</h3>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-0.5 border",
              cat.bg, cat.text, cat.border,
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", cat.dot)} />
              {cat.label}
            </span>
          </div>
        </div>

        {/* Compteur agences */}
        <div className="shrink-0 flex flex-col items-end gap-0.5">
          <span className="text-2xl font-black text-slate-900 leading-none">
            {brand.branches.length}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            {brand.branches.length > 1 ? "agences" : "agence"}
          </span>
        </div>
      </div>

      {/* ── Produits Vedettes ────────────────────────────────────────── */}
      {brand.featured_products.length > 0 ? (
        <div className="px-5 py-4 border-b border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
            Produits vedettes
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            {brand.featured_products.map((product) => (
              <div key={product.id} className="shrink-0 w-[90px] group/prod cursor-default">
                {/* Image produit */}
                <div className="w-[90px] h-[72px] rounded-xl overflow-hidden bg-slate-50 border border-slate-100 mb-2 shadow-sm transition-transform duration-200 group-hover/prod:scale-[1.03]">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name_fr ?? product.name}
                      width={90}
                      height={72}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-slate-300" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-700 truncate leading-tight">
                  {product.name_fr ?? product.name}
                </p>
                <p className="text-[11px] font-bold text-brand-600 mt-0.5">
                  {formatCurrency(product.price)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-5 py-3 border-b border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            Produits vedettes
          </p>
          <p className="text-xs text-slate-300 italic">Aucun produit disponible</p>
        </div>
      )}

      {/* ── Agences (triées par distance) ────────────────────────────── */}
      <div className="px-5 py-4 flex-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Agences
            {geoAvailable && (
              <span className="ml-1.5 text-brand-500 normal-case font-medium tracking-normal">
                · triées par distance
              </span>
            )}
          </p>
          {!geoAvailable && (
            <span className="flex items-center gap-1 text-[10px] text-slate-300">
              <WifiOff className="w-3 h-3" />
              GPS non disponible
            </span>
          )}
        </div>

        {brand.branches.length === 0 ? (
          <p className="text-xs text-slate-300 italic">Aucune agence</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {visibleBranches.map((branch) => (
              <BranchRow key={branch.id} branch={branch} geoAvailable={geoAvailable} />
            ))}
          </div>
        )}

        {hasMoreBranches && (
          <button
            onClick={() => setBranchesExpanded((v) => !v)}
            className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-brand-500 hover:text-brand-700 transition-colors"
          >
            {branchesExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                Réduire
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                {sortedBranches.length - 3} agence{sortedBranches.length - 3 > 1 ? "s" : ""} de plus
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function CataloguePage() {
  const t = useTranslations("catalogue");
  const [search, setSearch] = useState("");
  const [geo, setGeo] = useState<GeoState>({ lat: null, lng: null, loading: false, error: null });

  // ── Géolocalisation ───────────────────────────────────────────────
  const requestGeo = useCallback(() => {
    if (!navigator.geolocation) {
      setGeo((g) => ({ ...g, error: "Géolocalisation non supportée par ce navigateur" }));
      return;
    }
    setGeo((g) => ({ ...g, loading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          loading: false,
          error: null,
        });
      },
      (err) => {
        setGeo((g) => ({
          ...g,
          loading: false,
          error: err.code === 1 ? "Accès à la géolocalisation refusé" : "Impossible d'obtenir la position",
        }));
      },
      { timeout: 8000, maximumAge: 120_000 },
    );
  }, []);

  // Demander la géoloc au montage automatiquement
  useEffect(() => {
    requestGeo();
  }, [requestGeo]);

  // ── Données catalogue ──────────────────────────────────────────────
  const { data: brands, isLoading, error: fetchError, refetch, isFetching } = useQuery<CatalogueBrand[]>({
    queryKey: ["catalogue"],
    queryFn: () => apiGet<CatalogueBrand[]>("/brands/catalogue"),
    staleTime: 5 * 60_000,
  });

  // ── Filtrage par recherche ─────────────────────────────────────────
  const filtered = (brands ?? []).filter((brand) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const primaryCat = getPrimaryCategory(brand.branches);
    const catLabel = CATEGORY_CONFIG[primaryCat]?.label ?? "";
    return (
      brand.name.toLowerCase().includes(q) ||
      catLabel.toLowerCase().includes(q) ||
      brand.description?.toLowerCase().includes(q)
    );
  });

  const geoAvailable = geo.lat !== null && geo.lng !== null;
  const totalBranches = (brands ?? []).reduce((sum, b) => sum + b.branches.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{t("subtitle")}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
        </div>

        {/* Stats rapides */}
        {!isLoading && brands && (
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Building2 className="w-3.5 h-3.5 text-brand-500" />
              {brands.length} marque{brands.length > 1 ? "s" : ""}
            </span>
            <span className="w-1 h-1 rounded-full bg-slate-300" />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              {totalBranches} agence{totalBranches > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* ── Barre de recherche + géolocalisation ──────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Recherche */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9 bg-white border-slate-200 rounded-xl h-10 text-sm shadow-sm"
          />
        </div>

        {/* Géolocalisation */}
        <button
          onClick={requestGeo}
          disabled={geo.loading}
          className={cn(
            "flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold border transition-all duration-200",
            geoAvailable
              ? "bg-brand-50 border-brand-200 text-brand-700 hover:bg-brand-100"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50",
            geo.loading && "opacity-60 cursor-not-allowed",
          )}
        >
          {geo.loading ? (
            <>
              <Navigation2 className="w-4 h-4 animate-pulse" />
              Localisation…
            </>
          ) : geoAvailable ? (
            <>
              <Navigation className="w-4 h-4 text-brand-500" />
              Position active
            </>
          ) : (
            <>
              <Navigation2 className="w-4 h-4 text-slate-400" />
              Activer ma position
            </>
          )}
        </button>
      </div>

      {/* Erreur géo (non bloquante) */}
      {geo.error && (
        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {geo.error} — les agences seront affichées sans tri de distance.
        </div>
      )}

      {/* ── Erreur chargement ────────────────────────────────────────── */}
      {fetchError && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <AlertCircle className="w-8 h-8 text-slate-300" />
          <p className="text-sm text-slate-400">{t("errorLoading")}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Réessayer
          </Button>
        </div>
      )}

      {/* ── Grille Catalogue ─────────────────────────────────────────── */}
      {!fetchError && (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <BrandCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Building2 className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-400">
                {search ? `Aucune marque trouvée pour "${search}"` : t("noBrands")}
              </p>
              {search && (
                <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                  Effacer la recherche
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((brand) => (
                <BrandCard
                  key={brand.id}
                  brand={brand}
                  userLat={geo.lat}
                  userLng={geo.lng}
                  geoAvailable={geoAvailable}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
