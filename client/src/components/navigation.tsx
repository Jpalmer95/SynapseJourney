import { Link, useLocation } from "wouter";
import { Compass, Map, GitBranch, Telescope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const navItems = [
  { href: "/", icon: Compass, label: "Command" },
  { href: "/map", icon: Map, label: "3D Map" },
  { href: "/pathways", icon: GitBranch, label: "Pathways" },
  { href: "/open-science", icon: Telescope, label: "Science" },
  { href: "/profile", icon: User, label: "Journey" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-lg border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 h-14 w-14 shrink-0",
                  isActive && "text-primary"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <span className={cn("text-[10px] leading-tight", isActive ? "text-primary font-medium" : "text-muted-foreground")}>
                  {item.label}
                </span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function SideNav() {
  const [location] = useLocation();

  return (
    <nav className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 w-16 flex-col items-center py-4 bg-sidebar border-r border-sidebar-border">
      <Link href="/">
        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary mb-8 cursor-pointer" data-testid="logo-synapse">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
      </Link>
      
      <div className="flex flex-col items-center gap-3 flex-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "relative group",
                  isActive && "bg-sidebar-accent text-primary"
                )}
                data-testid={`sidenav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <item.icon className="h-5 w-5" />
                <span className="absolute left-14 px-2.5 py-1 rounded-md bg-popover text-popover-foreground text-xs font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity border border-border shadow-md">
                  {item.label}
                </span>
              </Button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
