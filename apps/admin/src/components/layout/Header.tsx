"use client";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth";
import { useRouter, usePathname } from "next/navigation";
import { Globe, ChevronDown, Settings, LogOut, Bell } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function Header({ locale }: { locale: string }) {
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
    router.push(pathname.replace(`/${locale}`, `/${newLocale}`));
  };

  return (
    <header className="fixed top-0 right-0 left-64 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur-sm shadow-[0_1px_3px_0_rgba(0,0,0,0.05)]">

      {/* Breadcrumb / titre */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 font-medium">Dash Meal</span>
          <ChevronDown className="h-3 w-3 text-slate-300 -rotate-90" />
          <span className="text-sm font-semibold text-slate-700">
            {user?.role === "superadmin" ? "Super Admin" : user?.brand_name ?? "Admin"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          onClick={() => router.push(`/${locale}/notifications`)}
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* Langue */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-medium">
              <Globe className="h-4 w-4" />
              <span className="text-xs uppercase font-semibold">{locale}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white border-slate-200 shadow-lg">
            <DropdownMenuLabel className="text-slate-500 text-xs">{tSettings("language")}</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem onClick={() => switchLocale("fr")} className={locale === "fr" ? "text-brand-600 font-semibold bg-brand-50" : "text-slate-700"}>
              🇫🇷 Français
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => switchLocale("en")} className={locale === "en" ? "text-brand-600 font-semibold bg-brand-50" : "text-slate-700"}>
              🇬🇧 English
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Profil */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 pl-2 pr-3 text-slate-700 hover:bg-slate-100">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-gradient-to-br from-brand-500 to-brand-700 text-white text-xs font-bold">
                  {getInitials(user?.username ?? "AD")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:block text-slate-700">{user?.username}</span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-white border-slate-200 shadow-lg">
            <DropdownMenuLabel>
              <p className="font-semibold text-slate-900">{user?.username}</p>
              <p className="text-xs text-slate-400 capitalize font-normal">{user?.role}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem onClick={() => router.push(`/${locale}/settings`)} className="text-slate-700 hover:bg-slate-50">
              <Settings className="mr-2 h-4 w-4 text-slate-400" />
              {tSettings("title")}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-100" />
            <DropdownMenuItem onClick={handleLogout} destructive className="text-red-600 hover:bg-red-50">
              <LogOut className="mr-2 h-4 w-4" />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
