"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";

/**
 * Shared layout that persists the Navbar across all main pages.
 * This prevents the Navbar from being destroyed and re-created on each navigation,
 * eliminating layout shifts and re-fetch flashes.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <Suspense>
        <PersistentNavbar />
      </Suspense>
      <main className="flex-1 animate-page-in">{children}</main>
    </div>
  );
}

/**
 * Navbar wrapper that syncs search query across pages.
 * Wrapped in Suspense because it uses useSearchParams.
 */
function PersistentNavbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");

  // Read the search query from URL on home page
  useEffect(() => {
    if (pathname === "/") {
      const q = searchParams.get("q")?.trim() ?? "";
      setSearchQuery(q);
    }
  }, [pathname, searchParams]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    // Dispatch a custom event so CarAdvisor can listen for search changes from the shared navbar
    window.dispatchEvent(
      new CustomEvent("navbar-search-change", { detail: value }),
    );
  }, []);

  return (
    <Navbar
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
    />
  );
}
