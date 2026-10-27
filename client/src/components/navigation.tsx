import { Link, useLocation } from "wouter";
import { Compass, Map, GitBranch, Telescope, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Compass, label: "Command" },
  { href: "/map", icon: Map, label: "3D Map" },
  { href: "/pathways", icon: GitBranch, label: "Pathways" },
  { href: "/open-science", icon: Telescope, label: "Science" },
  { href: "/profile", icon: User, label: "Journey" },
];

/**
 * Nav items are single anchors, not <Link><Button/></Link>: the old markup nested a
 * <button> inside an <a> (invalid HTML), doubled the tab stops — two focus stops per
 * destination — and left the icon-only sidebar links with no accessible name at all.
 */
export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-lg border-t border-border md:hidden"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 h-14 w-14 shrink-0 rounded-md transition-colors",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "text-primary",
              )}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  isActive ? "text-primary font-medium" : "text-muted-foreground",
                )}
              >
                {item.label}
              </span>
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
    <nav
      aria-label="Primary"
      className="hidden md:flex fixed left-0 top-0 bottom-0 z-50 w-16 flex-col items-center py-4 bg-sidebar border-r border-sidebar-border"
    >
      <Link
        href="/"
        aria-label="Synapse home"
        className="flex items-center justify-center w-10 h-10 rounded-md bg-primary mb-8 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-testid="logo-synapse"
      >
        <Sparkles className="h-5 w-5 text-primary-foreground" />
      </Link>

      <div className="flex flex-col items-center gap-3 flex-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative group flex items-center justify-center h-10 w-10 rounded-md transition-colors",
                "hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "bg-sidebar-accent text-primary",
              )}
              data-testid={`sidenav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <item.icon className="h-5 w-5" />
              <span
                aria-hidden="true"
                className="absolute left-14 px-2.5 py-1 rounded-md bg-popover text-popover-foreground text-xs font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity border border-border shadow-md"
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
