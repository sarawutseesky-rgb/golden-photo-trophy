import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Star, Upload, LogOut, User, Shield, PanelLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { unreadCount } from "@/lib/notifications.functions";
import { checkAdmin } from "@/lib/profile.functions";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CommandPalette, SearchTrigger, useCommandPalette } from "@/components/app/CommandPalette";
import { Search } from "lucide-react";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const fetchUnread = useServerFn(unreadCount);
  const checkAdminFn = useServerFn(checkAdmin);
  const [count, setCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const palette = useCommandPalette();

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const tick = () => fetchUnread().then((r) => alive && setCount(r.count)).catch(() => {});
    tick();
    const i = setInterval(tick, 30000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, [user, fetchUnread]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    checkAdminFn()
      .then((r) => setIsAdmin(r.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [user, checkAdminFn]);

  return (
    <header className="header-blur sticky top-0 z-40 border-b border-border/50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <Link to="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <Star className="h-5 w-5 fill-[var(--gold)] text-[var(--gold)]" />
            <span>StarShot</span>
          </Link>
        </div>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link to="/" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Feed
          </Link>
          <Link to="/top" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Top
          </Link>
          <Link to="/hall-of-fame" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Hall of Fame
          </Link>
          <Link to="/trending" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
            Trending
          </Link>
          {isAdmin && (
            <Link to="/admin" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>
              <span className="inline-flex items-center gap-1">
                <Shield className="h-3.5 w-3.5" />
                Admin
              </span>
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-2">
          <SearchTrigger onOpen={() => palette.setOpen(true)} />
          <button
            type="button"
            onClick={() => palette.setOpen(true)}
            aria-label="Search"
            className="rounded-md p-2 hover:bg-muted sm:hidden"
          >
            <Search className="h-4 w-4" />
          </button>
          {user ? (
            <>
              <Link
                to="/upload"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Upload className="h-4 w-4" /> Upload
              </Link>
              <Link to="/notifications" className="relative rounded-md p-2 hover:bg-muted" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--gold)] px-1 text-[10px] font-bold text-primary-foreground">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </Link>
              <Link to="/profile/me" className="rounded-md p-2 hover:bg-muted" aria-label="Profile">
                <User className="h-4 w-4" />
              </Link>
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-md px-3 py-1.5 text-sm hover:bg-muted">
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
      <CommandPalette open={palette.open} setOpen={palette.setOpen} />
    </header>
  );
}