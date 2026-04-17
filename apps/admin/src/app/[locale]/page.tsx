"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { Spinner } from "@/components/ui/spinner";

export default function RootPage() {
  const { locale } = useParams<{ locale: string }>();
  const { isAuthenticated, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.replace(`/${locale}/login`);
      return;
    }
    if (user.role === "superadmin") {
      router.replace(`/${locale}/superadmin/platform`);
    } else {
      router.replace(`/${locale}/dashboard`);
    }
  }, [isAuthenticated, user, locale, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-surface-950">
      <Spinner size="lg" />
    </div>
  );
}
