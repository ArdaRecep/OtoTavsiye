"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  CarFront,
  Folder,
  Grid2X2,
  Heart,
  Loader2,
  LogOut,
  PenLine,
  Search,
  X,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { getStoredUserId, getStoredUserName, getStoredAvatarUrl } from "@/lib/user-identity";

export type ActiveTab = "recommendations" | "comparisons" | "favorites" | "settings";

export const navItems: { id: ActiveTab; label: string; icon: typeof PenLine }[] = [
  { id: "recommendations", label: "Öneriler", icon: PenLine },
  { id: "comparisons", label: "Karşılaştırmalar", icon: Grid2X2 },
  { id: "favorites", label: "Favoriler", icon: Heart },
];

export function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5 transition hover:opacity-80">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
        <CarFront className="h-5 w-5" />
      </div>
      <div className="hidden text-sm font-semibold sm:block">Araç karar motoru</div>
    </Link>
  );
}

export function AuthButtons() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const id = getStoredUserId();
    if (id) {
      setUserId(id);
      setUsername(getStoredUserName());
      setAvatarUrl(getStoredAvatarUrl());
    }
  }, []);

  function handleLogout() {
    localStorage.removeItem("oto_tavsiye_user_id");
    localStorage.removeItem("oto_tavsiye_username");
    localStorage.removeItem("oto_tavsiye_avatar");
    window.location.href = "/";
  }

  if (userId && username) {
    const initial = username.charAt(0).toUpperCase();

    return (
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
              {initial}
            </div>
          )}
          <span className="hidden text-sm font-semibold text-emerald-50 sm:block">{username}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-8 w-8 items-center justify-center rounded-md text-emerald-100/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Çıkış yap"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/giris"
        className="rounded-md px-3 py-1.5 text-sm font-semibold text-emerald-50/90 transition hover:bg-white/10"
      >
        Giriş Yap
      </Link>
      <Link
        href="/kayit"
        className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-[#014636] transition hover:bg-emerald-50"
      >
        Kayıt Ol
      </Link>
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<{ suggestions: string[]; categories: string[] }>({
    suggestions: [],
    categories: [],
  });
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(value, 300);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults({ suggestions: [], categories: [] });
      setIsOpen(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`/api/autocomplete?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setResults({
          suggestions: data.suggestions || [],
          categories: data.categories || [],
        });
        setIsOpen((data.suggestions && data.suggestions.length > 0) || (data.categories && data.categories.length > 0));
      })
      .catch((err) => console.error("Autocomplete error:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  return (
    <div className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-50/60" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => {
          onChange(event.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => {
          if (value.length >= 2 && (results.suggestions.length > 0 || results.categories.length > 0)) {
            setIsOpen(true);
          }
        }}
        onBlur={() => {
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder="Marka veya model ara..."
        aria-label="Araç ara"
        className="h-9 w-full rounded-md border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-emerald-50/50 focus:border-white/40 focus:bg-white/15"
      />

      {isOpen && (
        <div className="absolute top-full mt-1.5 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white text-left shadow-xl z-50">
          {loading ? (
            <div className="flex items-center justify-center p-4 text-sm text-neutral-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Aranıyor...
            </div>
          ) : (
            <div className="py-2">
              {results.categories.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 pb-1.5 text-xs font-semibold text-neutral-400">Kategoriler</div>
                  {results.categories.map((cat, i) => (
                    <button
                      key={i}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                      onClick={() => {
                        const parts = cat.split(" > ");
                        const query = parts.slice(2).join(" ");
                        onChange(query);
                        setIsOpen(false);
                      }}
                    >
                      <Folder className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{cat}</span>
                    </button>
                  ))}
                </div>
              )}

              {results.categories.length > 0 && results.suggestions.length > 0 && (
                <div className="my-1.5 h-px bg-neutral-100" />
              )}

              {results.suggestions.length > 0 && (
                <div>
                  <div className="px-3 pb-1.5 text-xs font-semibold text-neutral-400">Öneriler</div>
                  {results.suggestions.map((sug, i) => (
                    <button
                      key={i}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                      onClick={() => {
                        onChange(sug);
                        setIsOpen(false);
                      }}
                    >
                      <Search className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="truncate">{sug}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Navbar({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
}: {
  activeTab?: ActiveTab | null;
  onTabChange?: (tab: ActiveTab) => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleTabChange = (tab: ActiveTab) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      router.push(`/?tab=${tab}`);
    }
  };

  const handleSearchChange = (value: string) => {
    if (onSearchChange && pathname === "/") {
      onSearchChange(value);
    } else {
      router.push(`/?q=${encodeURIComponent(value)}`);
    }
  };

  const navLinks = (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.id === activeTab;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => handleTabChange(item.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
              isActive ? "bg-[#0b513c] text-white" : "text-emerald-50/90 hover:bg-white/10"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-950/30 bg-[#00261e] text-white shadow-sm">
      <div className="mx-auto w-full max-w-[1920px] px-3 py-2.5 sm:px-5">
        {/* Masaüstü: tek satır */}
        <div className="hidden items-center gap-4 lg:flex">
          <Brand />
          <div className="relative w-52 shrink-0 xl:w-72">
            <SearchField value={searchQuery || ""} onChange={handleSearchChange} />
          </div>
          {navLinks}
          <div className="flex-1" />
          <AuthButtons />
        </div>

        {/* Mobil: büyüteç ikonu tıklanınca açılan arama */}
        <div className="lg:hidden">
          {mobileSearchOpen ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <SearchField value={searchQuery || ""} onChange={handleSearchChange} autoFocus />
              </div>
              <button
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/80 transition hover:bg-white/10"
                aria-label="Aramayı kapat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Brand />
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(true)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white/90 transition hover:bg-white/10"
                  aria-label="Ara"
                >
                  <Search className="h-5 w-5" />
                </button>
                <AuthButtons />
              </div>
              <div className="mt-2">{navLinks}</div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
