"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { FullPageSpinner } from "@/components/ui";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="bg-paper min-h-screen">
        <FullPageSpinner />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-paper min-h-screen">
        <FullPageSpinner />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
