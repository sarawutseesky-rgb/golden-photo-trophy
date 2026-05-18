import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Trophy,
  Award,
  TrendingUp,
  Shield,
  PanelLeft,
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
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    checkAdminFn()
      .then((r) => setIsAdmin(r.isAdmin))
      .catch(() => setIsAdmin(false));
  }, [user, checkAdminFn]);

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border bg-card/50"
    >
      <SidebarContent>
        <SidebarGroup defaultOpen>
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
              {isAdmin && (
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
