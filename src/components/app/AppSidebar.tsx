import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Trophy,
  Award,
  TrendingUp,
  Shield,
  PanelLeft,
  RefreshCw,
  LayoutDashboard,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useServerFn } from "@tanstack/react-start";
import { checkAdmin } from "@/lib/profile.functions";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

const navItems = [
  { title: "Feed", url: "/", icon: Home },
  { title: "Top", url: "/top", icon: Trophy },
  { title: "Hall of Fame", url: "/hall-of-fame", icon: Award },
  { title: "Trending", url: "/trending", icon: TrendingUp },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({
    select: (router) => router.location.pathname,
  });

  const { user } = useAuth();
  const checkAdminFn = useServerFn(checkAdmin);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);
  const [adminCheckError, setAdminCheckError] = useState(false);

  const runAdminCheck = useCallback(() => {
    setIsCheckingAdmin(true);
    checkAdminFn()
      .then((r) => {
        setIsAdmin(r.isAdmin);
        setAdminCheckError(false);
      })
      .catch(() => {
        setIsAdmin(false);
        setAdminCheckError(true);
      })
      .finally(() => setIsCheckingAdmin(false));
  }, [checkAdminFn]);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsCheckingAdmin(false);
      setAdminCheckError(false);
      return;
    }
    runAdminCheck();
  }, [user, runAdminCheck]);

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card/50"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <Link
                      to={item.url}
                      className={cn(
                        "flex items-center gap-2 transition-colors",
                        isActive(item.url)
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isCheckingAdmin && !adminCheckError && (
                <SidebarMenuItem data-testid="admin-loading">
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="h-4 w-4 shrink-0 rounded" />
                    {!collapsed && <Skeleton className="h-4 w-16" />}
                  </div>
                </SidebarMenuItem>
              )}
              {!isCheckingAdmin && isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin")}
                    tooltip={collapsed ? "Admin" : undefined}
                  >
                    <Link
                      to="/admin"
                      className={cn(
                        "flex items-center gap-2 transition-colors",
                        isActive("/admin")
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Shield className="h-4 w-4 shrink-0" />
                      <span>Admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {!isCheckingAdmin && isAdmin && (
                <SidebarMenuItem data-testid="admin-dashboard-menu">
                  <SidebarMenuButton
                    asChild
                    isActive={isActive("/admin/dashboard")}
                    tooltip={collapsed ? "Admin Dashboard" : undefined}
                  >
                    <Link
                      to="/admin/dashboard"
                      className={cn(
                        "flex items-center gap-2 transition-colors",
                        isActive("/admin/dashboard")
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <LayoutDashboard className="h-4 w-4 shrink-0" />
                      <span>Admin Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {adminCheckError && (
                <SidebarMenuItem data-testid="admin-retry">
                  <SidebarMenuButton
                    onClick={runAdminCheck}
                    disabled={isCheckingAdmin}
                    aria-busy={isCheckingAdmin}
                    tooltip={
                      collapsed
                        ? isCheckingAdmin
                          ? "กำลังตรวจสอบ..."
                          : "ลองตรวจสอบอีกครั้ง"
                        : undefined
                    }
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isCheckingAdmin && "animate-spin"
                      )}
                    />
                    <span>
                      {isCheckingAdmin ? "กำลังตรวจสอบ..." : "ลองตรวจสอบอีกครั้ง"}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
