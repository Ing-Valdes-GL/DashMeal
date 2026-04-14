"use client";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth";
import { useRouter, usePathname } from "next/navigation";
import {
  Globe, ChevronDown, Settings, LogOut, User,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface HeaderProps {
  locale: string;
  title?: string;
}

export function Header({ locale, title }: HeaderProps) {
  const t = useTranslations("nav");
  const tSettings = useTranslations("settings");
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    logout();
    toast.success(t("logout"));
    router.push(`/${locale}/login`);
  };

  const switchLocale = (newLocale: string) => {
    // Remplacer le préfixe de locale dans le chemin
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <header className="fixed top-0 right-0 left-64 z-30 flex h-16 items-center justify-between border-b border-surface-700/50 bg-surface-950/80 px-6 backdrop-blur-sm">
      {/* Titre de la page (passé optionnellement) */}
      <div className="flex items-center gap-2">
        {title && (
          <h1 className="text-base font-semibold text-white">{title}</h1>
        )}
      </div>

      {/* Actions côté droit */}
      <div className="flex items-center gap-2">
        {/* Sélecteur de langue */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-400">
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium uppercase">{locale}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{tSettings("language")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => switchLocale("fr")} className={locale === "fr" ? "text-brand-400" : ""}>
              🇫🇷 Français
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchLocale("en")} className={locale === "en" ? "text-brand-400" : ""}>
              🇬🇧 English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Avatar + menu utilisateur */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 pl-2 pr-3 text-slate-300 hover:text-white">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {getInitials(user?.username ?? "AD")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:block">{user?.username}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div>
                <p className="font-medium text-white">{user?.username}</p>
                <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push(`/${locale}/settings`)}>
              <Settings className="mr-2 h-4 w-4" />
              {tSettings("title")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} destructive>
              <LogOut className="mr-2 h-4 w-4" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
