"use client";
import { useEffect, use } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ProductsPage() {
  const router = useRouter();
  const params = useParams();
  useEffect(() => {
    router.replace(`/${params.locale}/branches`);
  }, [router, params.locale]);
  return null;
}
