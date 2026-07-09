"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Bell,
  BookOpen,
  Folder,
  Grid2X2,
  Heart,
  Loader2,
  LogOut,
  PenLine,
  Search,
  ShieldCheck,
  X,
  Menu,
} from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useCurrentUser } from "@/lib/auth/client-user";
import { ComparisonFloatingButton } from "./comparison-floating-button";
import useSWR from "swr";
import type { NotificationRow } from "@/app/api/notifications/route";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export type ActiveTab = "recommendations" | "comparisons" | "favorites" | "blog" | "admin";

export const navItems: { id: ActiveTab; label: string; icon: typeof PenLine; href: string; widthClass: string }[] = [
  { id: "recommendations", label: "Öneriler", icon: PenLine, href: "/", widthClass: "w-[110px]" },
  { id: "comparisons", label: "Karşılaştırmalar", icon: Grid2X2, href: "/karsilastirmalar", widthClass: "w-[160px]" },
  { id: "favorites", label: "Favoriler", icon: Heart, href: "/favoriler", widthClass: "w-[110px]" },
  { id: "blog", label: "Blog", icon: BookOpen, href: "/blog", widthClass: "w-[90px]" },
];

type SearchResults = {
  suggestions: string[];
  categories: string[];
};


export function Brand() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-3 transition hover:opacity-90" aria-label="HangiAraç ana sayfa">
      <span
        className="h-11 w-11 rounded-xl border border-white/10 bg-contain bg-center bg-no-repeat shadow-sm"
        style={{ backgroundImage: "url('/hangiArac.png')" }}
        aria-hidden="true"
      />
      <span className="text-[1.35rem] font-black tracking-tight">
        <span className="text-white">Hangi</span>
        <span className="text-emerald-300">Araç</span>
      </span>
    </Link>
  );
}

export function AuthButtons({ mobileMode = false }: { mobileMode?: boolean }) {
  const router = useRouter();
  const { user, userId, isAdmin, mutate } = useCurrentUser();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: notificationsData, mutate: mutateNotifications } = useSWR<{ notifications: NotificationRow[] }>(
    userId ? "/api/notifications" : null,
    fetcher,
    { refreshInterval: 15000 } // Her 15 saniyede bir yeni bildirimleri kontrol et
  );

  const notifications = notificationsData?.notifications || [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function handleLogout() {
    await fetch("/api/auth", { method: "DELETE" });
    await mutate({ user: null }, { revalidate: false });
    router.refresh();
    router.push("/");
  }

  if (userId && user) {
    const username = user.username;
    const avatarUrl = user.avatarUrl;
    const initial = username.charAt(0).toUpperCase();

    if (mobileMode) {
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt={username} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                {initial}
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-base font-semibold text-white">{username}</span>
              {isAdmin && <span className="text-xs text-emerald-400">Admin</span>}
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center rounded-md text-emerald-100/60 transition hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-2">
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg bg-white/5 px-4 py-3 transition hover:bg-white/10"
              onClick={() => {
                const nextState = !notificationsOpen;
                setNotificationsOpen(nextState);
                if (nextState && unreadCount > 0) {
                  fetch("/api/notifications", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ markAllAsRead: true }),
                  }).then(() => mutateNotifications());
                }
              }}
            >
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-emerald-100/80" />
                <span className="text-sm font-medium text-white">Bildirimler</span>
              </div>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div className="mt-2 rounded-xl border border-white/10 bg-black/20 p-2">
                {notifications.length === 0 ? (
                  <div className="p-3 text-center text-sm text-emerald-100/60">Henüz bildirim yok.</div>
                ) : (
                  <div className="flex max-h-[250px] flex-col gap-1 overflow-y-auto">
                    {notifications.map((notif) => {
                      let title = "";
                      if (notif.type === "reply") {
                        title = `${notif.actor?.username || "Biri"} size yanıt verdi.`;
                      } else if (notif.type === "vehicle_comment") {
                        title = `Yorum yapmış olduğunuz ${notif.vehicle?.make || "bir"} ${notif.vehicle?.model || "araca"} yorum yapıldı.`;
                      }

                      return (
                        <Link
                          key={notif.id}
                          href={notif.vehicle_id ? (notif.comment_id ? `/cars/${notif.vehicle_id}#comment-${notif.comment_id}` : `/cars/${notif.vehicle_id}`) : "#"}
                          className={`block rounded-lg p-3 transition hover:bg-white/5 ${
                            !notif.is_read ? "bg-emerald-900/40" : "bg-transparent"
                          }`}
                        >
                          <p className="text-sm font-medium text-emerald-50">{title}</p>
                          <p className="mt-1 text-xs text-emerald-100/50">
                            {new Intl.DateTimeFormat("tr-TR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(notif.created_at))}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex shrink-0 items-center gap-3">
        {isAdmin ? (
          <Link
            href="/admin"
            className="hidden h-8 items-center gap-1.5 rounded-md border border-emerald-300/20 px-2.5 text-xs font-semibold text-emerald-50/90 transition hover:bg-white/10 sm:inline-flex"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin
          </Link>
        ) : null}

        {/* Bildirimler */}
        <div className="relative">
          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-md text-emerald-100/60 transition hover:bg-white/10 hover:text-white"
            onClick={() => {
              const nextState = !notificationsOpen;
              setNotificationsOpen(nextState);
              if (nextState && unreadCount > 0) {
                // Bildirimler açıldığında hepsini okundu olarak işaretle
                fetch("/api/notifications", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ markAllAsRead: true }),
                }).then(() => mutateNotifications());
              }
            }}
            onBlur={() => setTimeout(() => setNotificationsOpen(false), 200)}
            aria-label="Bildirimler"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-[#00261e]">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Açılır Bildirim Menüsü */}
          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-neutral-300 bg-white shadow-2xl z-50">
              <div className="border-b border-neutral-100 bg-neutral-50/50 px-4 py-3">
                <h3 className="text-sm font-semibold text-neutral-900">Bildirimler</h3>
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-neutral-500">Henüz bildirim yok.</div>
                ) : (
                  notifications.map((notif) => {
                    let title = "";
                    if (notif.type === "reply") {
                      title = `${notif.actor?.username || "Biri"} size yanıt verdi.`;
                    } else if (notif.type === "vehicle_comment") {
                      title = `Yorum yapmış olduğunuz ${notif.vehicle?.make || "bir"} ${notif.vehicle?.model || "araca"} yorum yapıldı.`;
                    }

                    return (
                      <Link
                        key={notif.id}
                        href={notif.vehicle_id ? (notif.comment_id ? `/cars/${notif.vehicle_id}#comment-${notif.comment_id}` : `/cars/${notif.vehicle_id}`) : "#"}
                        className={`block border-b border-neutral-50 p-4 transition hover:bg-neutral-50 ${
                          !notif.is_read ? "bg-emerald-50/30" : "bg-white"
                        }`}
                      >
                        <p className="text-sm font-medium text-neutral-800">{title}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {new Intl.DateTimeFormat("tr-TR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(notif.created_at))}
                        </p>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Kullanıcı Profili */}
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

  if (mobileMode) {
    return (
      <div className="flex flex-col gap-3">
        <Link
          href="/giris"
          className="flex items-center justify-center rounded-lg bg-white/10 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
        >
          Giriş Yap
        </Link>
        <Link
          href="/kayit"
          className="flex items-center justify-center rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
        >
          Kayıt Ol
        </Link>
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
  const [results, setResults] = useState<SearchResults>({
    suggestions: [],
    categories: [],
  });
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(value, 300);

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      queueMicrotask(() => {
        setResults({ suggestions: [], categories: [] });
        setIsOpen(false);
      });
      return;
    }

    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) setLoading(true);
    });

    fetch(`/api/autocomplete?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        const nextResults: SearchResults = {
          suggestions: data.suggestions || [],
          categories: data.categories || [],
        };

        setResults(nextResults);
        setIsOpen(nextResults.suggestions.length > 0 || nextResults.categories.length > 0);
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
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-50/65" />
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
        placeholder="Marka, model veya paket ara..."
        aria-label="Araç ara"
        className="h-11 w-full rounded-lg border border-white/15 bg-white/10 pl-11 pr-4 text-[15px] font-medium text-white outline-none transition placeholder:text-emerald-50/50 focus:border-white/40 focus:bg-white/15"
      />

      {isOpen && (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-neutral-300 bg-white text-left shadow-2xl">
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
                  {results.categories.map((cat) => (
                    <button
                      key={cat}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                      onClick={() => {
                        onChange(getCategorySearchQuery(cat));
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
                  {results.suggestions.map((sug) => (
                    <button
                      key={sug}
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
  searchQuery,
  onSearchChange,
}: {
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
}) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleSearchChange = (value: string) => {
    if (onSearchChange && pathname === "/") {
      onSearchChange(value);
    } else {
      router.push(`/?q=${encodeURIComponent(value)}`);
    }
  };

  const navLinks = (
    <nav className="-mx-1 flex shrink-0 items-center gap-1.5 overflow-x-auto px-1 lg:overflow-visible">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = isNavItemActive(pathname, item.href);

        return (
          <Link
            key={item.id}
            href={item.href}
            className={`inline-flex h-10 shrink-0 justify-center items-center gap-2 rounded-lg text-sm font-semibold transition ${item.widthClass} ${
              isActive ? "bg-[#0b513c] text-white" : "text-emerald-50/90 hover:bg-white/10"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-emerald-950/30 bg-[#00261e] text-white shadow-sm">
        <div className="mx-auto w-full max-w-[1920px] px-3 py-3 sm:px-5">
          {/* Masaüstü: tek satır */}
          <div className="hidden items-center gap-3 lg:flex xl:gap-5">
            <Brand />
            <div className="relative w-full max-w-[320px] xl:max-w-[540px] 2xl:max-w-[680px]">
              <SearchField value={searchQuery || ""} onChange={handleSearchChange} />
            </div>
            {navLinks}
            <div className="flex-1" />
            <AuthButtons />
          </div>

          {/* Mobil: Üst Bilgi Çubuğu */}
          <div className="lg:hidden">
            {mobileSearchOpen ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <SearchField value={searchQuery || ""} onChange={handleSearchChange} autoFocus />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSearchOpen(false)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10"
                  aria-label="Aramayı kapat"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <Brand />
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMobileSearchOpen(true)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/10"
                    aria-label="Ara"
                  >
                    <Search className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/90 transition hover:bg-white/10"
                    aria-label="Menüyü aç"
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobil Drawer Overlay */}
      <div 
        className={`fixed inset-0 z-50 flex lg:hidden transition-all duration-300 ${
          mobileMenuOpen ? "visible" : "invisible"
        }`}
      >
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          }`} 
          onClick={() => setMobileMenuOpen(false)} 
          aria-hidden="true" 
        />
        
        {/* Drawer Content */}
        <div 
          className={`absolute inset-y-0 right-0 w-[85%] max-w-sm bg-[#00261e] shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${
            mobileMenuOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <span className="text-lg font-bold text-white">Menü</span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 -mr-2"
              aria-label="Menüyü kapat"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-6">
            {/* Profil / Bildirimler (AuthButtons) */}
            <div>
              <AuthButtons mobileMode={true} />
            </div>
            
            <div className="h-px bg-white/10" />

            {/* Menü Linkleri */}
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-4 rounded-lg px-4 py-3.5 text-base font-semibold transition ${
                      isActive ? "bg-[#0b513c] text-white" : "text-emerald-50/80 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <ComparisonFloatingButton />
    </>
  );
}

function getCategorySearchQuery(category: string) {
  const parts = category.split(" > ").map((part) => part.trim()).filter(Boolean);

  return parts.length > 2 ? parts.slice(1).join(" ") : category;
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";

  return pathname === href || pathname.startsWith(`${href}/`);
}
