import { BottomNav, SideNav } from "@/components/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProfileMenu } from "@/components/user-profile-menu";

interface AppLayoutProps {
  children: React.ReactNode;
  showMobileHeader?: boolean;
  mobileTitle?: string;
}

export function AppLayout({ children, showMobileHeader = true, mobileTitle = "Synapse" }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <SideNav />

      <div className="md:pl-16">
        {showMobileHeader && (
          <header className="fixed top-0 right-0 z-40 p-4 md:hidden flex items-center justify-between w-full bg-background/50 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{mobileTitle}</span>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserProfileMenu />
            </div>
          </header>
        )}

        {!showMobileHeader && (
          <div className="fixed top-4 right-4 z-40 flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <UserProfileMenu />
          </div>
        )}

        <div className="hidden md:flex fixed top-4 right-4 z-40 items-center gap-2">
          <ThemeToggle />
          <UserProfileMenu />
        </div>

        <main className="pb-20 md:pb-0">
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
