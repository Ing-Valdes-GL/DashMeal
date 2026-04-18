"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import {
  ArrowRight, CheckCircle2, BarChart2, Wallet, Truck,
  QrCode, Bell, Shield, Star, ChevronRight,
  Smartphone, Globe, TrendingUp, Store, Users, Zap,
  MapPin, Clock, CreditCard,
} from "lucide-react";

// ── Logo SVG ─────────────────────────────────────────────────────────────────
function DashMealLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="14" fill="#16a34a"/>
      <rect width="48" height="48" rx="14" fill="url(#logoGrad)" opacity="0.3"/>
      <path d="M10 24C10 16.268 16.268 10 24 10s14 6.268 14 14-6.268 14-14 14S10 31.732 10 24z" fill="white" opacity="0.07"/>
      {/* Fork */}
      <path d="M18 14v5a3 3 0 0 0 2 2.83V34h2V21.83A3 3 0 0 0 24 19v-5h-1.5v4h-1v-4H20v4h-1v-4H18z" fill="white"/>
      {/* Lightning bolt */}
      <path d="M28 14l-3 8h3l-3 12 8-11h-4l3-9H28z" fill="#fde047"/>
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ade80"/>
          <stop offset="1" stopColor="#eab308"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Données ──────────────────────────────────────────────────────────────────
const STATS = [
  { value: "500+",  label: "Restaurants partenaires", icon: Store },
  { value: "50k+",  label: "Commandes / mois",         icon: TrendingUp },
  { value: "98%",   label: "Taux de satisfaction",     icon: Star },
  { value: "6",     label: "Pays CEMAC couverts",      icon: Globe },
];

const FEATURES = [
  {
    icon: BarChart2, color: "brand",
    title: "Analytics avancées",
    desc: "Suivez vos revenus, commandes et performances en temps réel. Exportez vos rapports en PDF.",
  },
  {
    icon: Wallet, color: "accent",
    title: "Wallet intégré",
    desc: "Chaque agence dispose de son propre wallet. Retirez vos fonds via Mobile Money en quelques clics.",
  },
  {
    icon: Truck, color: "brand",
    title: "Livraison optimisée",
    desc: "Gérez vos livreurs, suivez les livraisons en direct et définissez vos zones de livraison.",
  },
  {
    icon: QrCode, color: "accent",
    title: "Click & Collect QR",
    desc: "Générez des QR codes uniques pour chaque commande click & collect. Zéro friction en caisse.",
  },
  {
    icon: Bell, color: "brand",
    title: "Notifications push",
    desc: "Alertes instantanées pour chaque nouvelle commande, paiement confirmé ou livraison terminée.",
  },
  {
    icon: Shield, color: "accent",
    title: "Multi-agences sécurisé",
    desc: "Gérez plusieurs agences depuis un seul tableau de bord. Données isolées par agence.",
  },
];

const STEPS = [
  {
    num: "01", icon: FileText2,
    title: "Soumettez votre dossier",
    desc: "Remplissez le formulaire en ligne avec les informations de votre restaurant (NIU, logo, présence en ligne). Traitement en 48h.",
  },
  {
    num: "02", icon: CheckCircle2,
    title: "Validation par notre équipe",
    desc: "Nos équipes vérifient votre dossier et activent votre compte. Vous recevez vos identifiants par email.",
  },
  {
    num: "03", icon: Zap,
    title: "Lancez votre activité",
    desc: "Configurez vos agences, vos produits, et commencez à recevoir des commandes dès le premier jour.",
  },
];

function FileText2({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

const TESTIMONIALS = [
  {
    name: "Mama Ngozi Restaurant",
    location: "Douala, Cameroun",
    rating: 5,
    text: "Dash Meal a transformé notre activité. Les commandes en ligne représentent maintenant 60% de notre chiffre d'affaires.",
    avatar: "MN",
    color: "brand",
  },
  {
    name: "Le Sénégalais",
    location: "Yaoundé, Cameroun",
    rating: 5,
    text: "Le système de wallet est incroyable. Je retire mes gains directement sur MTN Mobile Money en moins de 2 minutes.",
    avatar: "LS",
    color: "accent",
  },
  {
    name: "Saveurs du Congo",
    location: "Brazzaville, Congo",
    rating: 5,
    text: "L'interface est très intuitive. Même notre équipe qui n'est pas tech a pu prendre en main le tableau de bord en quelques heures.",
    avatar: "SC",
    color: "brand",
  },
];

// ── Composant principal ───────────────────────────────────────────────────────
export default function LandingPage() {
  const { locale } = useParams<{ locale: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      router.replace(`/${locale}/${user.role === "superadmin" ? "superadmin/platform" : "dashboard"}`);
    }
  }, [isAuthenticated, user, locale, router]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">

      {/* ══ NAVBAR ══════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100" : "bg-transparent"
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={`/${locale}`} className="flex items-center gap-3">
            <DashMealLogo size={36} />
            <span className={`text-lg font-bold tracking-tight transition-colors ${scrolled ? "text-slate-900" : "text-white"}`}>
              Dash Meal
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Fonctionnalités", href: "#features" },
              { label: "Comment ça marche", href: "#steps" },
              { label: "Témoignages", href: "#testimonials" },
            ].map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-brand-400 ${scrolled ? "text-slate-600" : "text-white/80"}`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/login`}
              className={`text-sm font-semibold transition-colors ${
                scrolled ? "text-slate-700 hover:text-brand-600" : "text-white/90 hover:text-white"
              }`}
            >
              Connexion
            </Link>
            <Link
              href={`/${locale}/apply`}
              className="btn-primary text-sm py-2.5 px-5"
            >
              Devenir partenaire
            </Link>
          </div>
        </div>
      </nav>

      {/* ══ HERO ════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1920&q=85')" }}
        />
        {/* Overlay */}
        <div className="hero-overlay absolute inset-0" />
        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20 w-full">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-8 animate-fade-up">
              <span className="flex h-2 w-2 rounded-full bg-accent-400 animate-pulse" />
              <span className="text-sm text-white/90 font-medium">Plateforme #1 de livraison en zone CEMAC</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white leading-[1.05] tracking-tight mb-6 animate-fade-up">
              Gérez votre
              <span className="block text-gradient bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">
                restaurant
              </span>
              sans effort
            </h1>

            <p className="text-xl text-white/75 max-w-xl leading-relaxed mb-10 animate-fade-up">
              La seule plateforme pensée pour les restaurateurs d'Afrique Centrale.
              Commandes en ligne, livraison, analytics et paiements — tout en un.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up">
              <Link href={`/${locale}/apply`} className="btn-primary flex items-center gap-2 justify-center text-base">
                Démarrer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="#features"
                className="flex items-center gap-2 justify-center px-6 py-3 rounded-xl font-semibold text-white border border-white/30 hover:bg-white/10 transition-all duration-200 text-base"
              >
                Voir les fonctionnalités
              </Link>
            </div>

            {/* Social proof micro */}
            <div className="flex items-center gap-4 mt-10 animate-fade-up">
              <div className="flex -space-x-2">
                {["MN","LS","SC","AB","KF"].map((i, idx) => (
                  <div key={i} className="h-8 w-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: idx % 2 === 0 ? "#16a34a" : "#ca8a04" }}>
                    {i}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map(i => <Star key={i} className="h-3.5 w-3.5 fill-accent-400 text-accent-400" />)}
                </div>
                <p className="text-white/60 text-xs mt-0.5">+500 restaurants nous font confiance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 animate-bounce">
          <div className="w-5 h-8 rounded-full border-2 border-white/30 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 bg-white/60 rounded-full" />
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ════════════════════════════════════════════════════ */}
      <section className="bg-brand-600 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center">
                  <div className="flex justify-center mb-2">
                    <Icon className="h-6 w-6 text-brand-200" />
                  </div>
                  <p className="text-4xl font-black text-white mb-1">{stat.value}</p>
                  <p className="text-sm text-brand-200 font-medium">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ═════════════════════════════════════════════════════ */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="badge-green mb-4">Fonctionnalités</span>
            <h2 className="text-4xl lg:text-5xl font-black text-slate-900 mt-3 mb-4">
              Tout ce dont votre restaurant<br />
              <span className="text-gradient">a besoin pour grandir</span>
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Une suite complète d'outils conçus spécifiquement pour les restaurateurs de la zone CEMAC.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              const isGreen = f.color === "brand";
              return (
                <div key={f.title}
                  className="group bg-white rounded-2xl border border-slate-100 p-7 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
                >
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 ${
                    isGreen ? "bg-brand-100 text-brand-600" : "bg-accent-100 text-accent-600"
                  }`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
                  <div className={`mt-4 flex items-center gap-1 text-xs font-semibold ${isGreen ? "text-brand-600" : "text-accent-600"}`}>
                    <span>En savoir plus</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ SHOWCASE : Dashboard preview ═════════════════════════════════ */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="badge-yellow mb-4">Interface Admin</span>
              <h2 className="text-4xl font-black text-slate-900 mt-3 mb-5 leading-tight">
                Un tableau de bord
                <span className="text-gradient block">pensé pour l'Afrique</span>
              </h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                Interface disponible en français et en anglais. Fonctionne sur mobile, tablette et ordinateur.
                Données en temps réel, même avec une connexion lente.
              </p>
              <ul className="space-y-3">
                {[
                  "Multi-agences : gérez toutes vos succursales",
                  "Wallet par agence avec retrait Mobile Money",
                  "Analytics détaillées et rapports PDF",
                  "Gestion des livreurs et zones de livraison",
                  "QR Code click & collect intégré",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-brand-500 shrink-0" />
                    <span className="text-sm text-slate-700 font-medium">{item}</span>
                  </li>
                ))}
              </ul>
              <Link href={`/${locale}/apply`} className="btn-primary mt-10 inline-flex items-center gap-2">
                Créer mon compte
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Dashboard preview mockup */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-tr from-brand-100 to-accent-100 rounded-3xl opacity-60 blur-2xl" />
              <div className="relative bg-white rounded-2xl border border-slate-200 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden">
                {/* Mockup header */}
                <div className="bg-brand-600 px-5 py-3 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-white/20" />
                    <div className="h-3 w-3 rounded-full bg-white/20" />
                    <div className="h-3 w-3 rounded-full bg-white/20" />
                  </div>
                  <div className="flex-1 mx-4 h-5 bg-white/10 rounded-full" />
                </div>
                {/* Mockup body */}
                <div className="p-5 bg-slate-50">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: "Commandes", val: "247", color: "brand" },
                      { label: "Revenus", val: "485 000", color: "accent" },
                      { label: "Livreurs", val: "12", color: "brand" },
                    ].map((s) => (
                      <div key={s.label} className="bg-white rounded-xl p-3 border border-slate-100 shadow-card">
                        <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
                        <p className={`text-lg font-black ${s.color === "brand" ? "text-brand-600" : "text-accent-600"}`}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl border border-slate-100 shadow-card p-3">
                    <div className="flex justify-between mb-3">
                      <p className="text-xs font-semibold text-slate-700">Commandes récentes</p>
                      <span className="text-[10px] text-brand-600 font-semibold">Voir tout</span>
                    </div>
                    {[
                      { id: "#1247", status: "En livraison", amount: "8 500 FCFA", color: "blue" },
                      { id: "#1246", status: "Livré", amount: "12 000 FCFA", color: "green" },
                      { id: "#1245", status: "En préparation", amount: "6 750 FCFA", color: "yellow" },
                    ].map((o) => (
                      <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <span className="text-xs font-mono text-slate-500">{o.id}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          o.color === "green" ? "bg-brand-100 text-brand-700" :
                          o.color === "yellow" ? "bg-accent-100 text-accent-700" :
                          "bg-blue-100 text-blue-700"
                        }`}>{o.status}</span>
                        <span className="text-xs font-semibold text-slate-700">{o.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ═════════════════════════════════════════════════ */}
      <section id="steps" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="badge-green mb-4">Processus</span>
            <h2 className="text-4xl font-black text-slate-900 mt-3 mb-4">
              Rejoignez-nous en <span className="text-gradient">3 étapes</span>
            </h2>
            <p className="text-slate-500 max-w-md mx-auto">De la candidature à la première commande en ligne en moins de 48 heures.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-brand-300 to-accent-300" />

            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="relative flex flex-col items-center text-center group">
                  <div className="relative mb-6">
                    <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 shadow-card flex items-center justify-center group-hover:shadow-card-hover group-hover:border-brand-200 transition-all duration-300">
                      <Icon className="h-7 w-7 text-brand-600" />
                    </div>
                    <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-brand-600 text-white text-xs font-black flex items-center justify-center shadow-green">
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-xs">{step.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-14">
            <Link href={`/${locale}/apply`} className="btn-primary inline-flex items-center gap-2 text-base">
              Commencer ma candidature
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ MOBILE APP SECTION ═══════════════════════════════════════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-2 items-center">
              <div className="p-12">
                <span className="badge-yellow mb-4">Application Mobile</span>
                <h2 className="text-3xl font-black text-white mt-3 mb-4 leading-tight">
                  Vos clients commandent,<br />vous gérez depuis votre phone
                </h2>
                <p className="text-brand-100 leading-relaxed mb-8">
                  L'application Dash Meal est disponible sur iOS et Android. Vos clients passent leurs commandes facilement, vous les gérez en temps réel.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Smartphone, text: "iOS & Android" },
                    { icon: MapPin,     text: "Suivi GPS en direct" },
                    { icon: CreditCard, text: "Mobile Money intégré" },
                    { icon: Clock,      text: "Commandes 24h/24" },
                  ].map((f) => {
                    const Icon = f.icon;
                    return (
                      <div key={f.text} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4 text-brand-200" />
                        </div>
                        <span className="text-sm text-white font-medium">{f.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-center items-end px-12 pb-0 pt-12">
                {/* Phone mockup */}
                <div className="relative w-56 h-80 bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-6 bg-slate-900 flex justify-center items-center">
                    <div className="h-1.5 w-16 bg-slate-700 rounded-full" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 top-6 bg-gradient-to-b from-brand-50 to-white p-3">
                    <div className="bg-brand-600 rounded-xl p-3 mb-2">
                      <p className="text-[9px] text-brand-200">Bienvenue 👋</p>
                      <p className="text-xs font-bold text-white">Mami Beignet</p>
                    </div>
                    <div className="space-y-1.5">
                      {["Ndolé & Plantain", "Poulet DG", "Saumon braisé"].map((item, i) => (
                        <div key={item} className="bg-white rounded-lg p-2 flex items-center gap-2 shadow-sm border border-slate-100">
                          <div className={`h-7 w-7 rounded-lg ${i % 2 === 0 ? "bg-brand-100" : "bg-accent-100"} flex-shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] font-semibold text-slate-800 truncate">{item}</p>
                            <p className="text-[8px] text-slate-400">{3000 + i * 500} FCFA</p>
                          </div>
                          <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[8px] text-white font-bold ${i % 2 === 0 ? "bg-brand-600" : "bg-accent-500"}`}>+</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ═════════════════════════════════════════════════ */}
      <section id="testimonials" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="badge-yellow mb-4">Témoignages</span>
            <h2 className="text-4xl font-black text-slate-900 mt-3 mb-4">
              Ils ont transformé leur
              <span className="text-gradient block">activité avec Dash Meal</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name}
                className="bg-white rounded-2xl border border-slate-100 p-7 shadow-card hover:shadow-card-hover transition-all duration-300"
              >
                <div className="flex gap-0.5 mb-4">
                  {[1,2,3,4,5].map(i => (
                    <Star key={i} className="h-4 w-4 fill-accent-400 text-accent-400" />
                  ))}
                </div>
                <p className="text-slate-600 text-sm leading-relaxed mb-6 italic">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                    t.color === "brand" ? "bg-brand-600" : "bg-accent-500"
                  }`}>
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{t.location}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA SECTION ══════════════════════════════════════════════════ */}
      <section className="relative py-32 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1920&q=80')" }}
        />
        <div className="absolute inset-0" style={{ background: "rgba(15,23,42,0.85)" }} />

        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 mb-8">
            <Zap className="h-3.5 w-3.5 text-accent-400" />
            <span className="text-sm text-white/90 font-medium">Rejoignez +500 restaurants partenaires</span>
          </div>
          <h2 className="text-4xl lg:text-5xl font-black text-white mb-6 leading-tight">
            Prêt à digitaliser
            <span className="text-gradient block bg-gradient-to-r from-brand-400 to-accent-400 bg-clip-text text-transparent">
              votre restaurant ?
            </span>
          </h2>
          <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto leading-relaxed">
            Soumettez votre dossier aujourd'hui. Notre équipe vous contactera dans les 48 heures pour finaliser votre intégration.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href={`/${locale}/apply`} className="btn-primary flex items-center gap-2 justify-center text-base">
              Soumettre ma candidature
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/${locale}/login`}
              className="flex items-center gap-2 justify-center px-6 py-3 rounded-xl font-semibold text-white border border-white/30 hover:bg-white/10 transition-all text-base"
            >
              J'ai déjà un compte
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-5">
                <DashMealLogo size={38} />
                <span className="text-lg font-bold text-white">Dash Meal</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-500">
                La plateforme de livraison de repas pensée pour la zone CEMAC.
              </p>
              <div className="flex gap-3 mt-5">
                {["🇨🇲","🇨🇬","🇬🇦","🇨🇫","🇹🇩","🇬🇶"].map(flag => (
                  <span key={flag} className="text-lg" title="Zone CEMAC">{flag}</span>
                ))}
              </div>
            </div>

            {/* Links */}
            {[
              {
                title: "Produit",
                links: ["Fonctionnalités", "Tarifs", "API", "Changelog"],
              },
              {
                title: "Restaurant",
                links: ["Devenir partenaire", "Espace Admin", "Application mobile", "Support"],
              },
              {
                title: "Légal",
                links: ["Conditions d'utilisation", "Politique de confidentialité", "Mentions légales"],
              },
            ].map((col) => (
              <div key={col.title}>
                <p className="text-sm font-semibold text-white mb-4">{col.title}</p>
                <ul className="space-y-3">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-slate-500 hover:text-brand-400 transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600">
              © {new Date().getFullYear()} Dash Meal. Tous droits réservés.
            </p>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-brand-500 animate-pulse" />
              <span className="text-xs text-slate-500">Tous les systèmes opérationnels</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
