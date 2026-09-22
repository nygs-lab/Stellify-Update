import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import stellifyLogo from "@assets/Gemini_Generated_Image__(4)_1782094958510.png";
import {
  Home,
  BookOpen,
  Church,
  Users,
  Trophy,
  User,
  Shield,
  Settings,
  LogOut,
} from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  if (!user) return <>{children}</>;

  const navItems = [
    { title: "Member Hub", path: "/", icon: Home },
    { title: "Disciple Hub", path: "/disciple", icon: BookOpen },
    { title: "Church Hub", path: "/church", icon: Church },
    ...(user.role === "Admin" || user.role === "Pastor" || user.role === "Servant" || user.role === "SharingCaptain" || user.role === "CgAuditor" || user.role === "ChurchAuditor"
      ? [{ title: "Ministry Hub", path: "/ministry", icon: Users }] 
      : []),
    { title: "StellarBoard", path: "/stellarboard", icon: Trophy },
    { title: "Member Profile", path: "/profile", icon: User },
    ...(user.role === "Admin" ? [{ title: "Admin Panel", path: "/admin", icon: Shield }] : []),
    { title: "Settings", path: "/settings", icon: Settings },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2">
              <img src={stellifyLogo} alt="Stellify Logo" className="h-8 w-8 object-contain" />
              <span className="font-semibold text-lg tracking-tight">Stellify</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={location === item.path || location.startsWith(item.path + "/")}>
                        <Link href={item.path}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => logout()}>
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="md:hidden p-4 border-b">
            <SidebarTrigger />
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
