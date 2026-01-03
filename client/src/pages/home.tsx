import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { NebulaFeed } from "@/components/nebula-feed";
import { RabbitHole } from "@/components/rabbit-hole";
import { BottomNav, SideNav } from "@/components/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User } from "lucide-react";
import type { Topic, Category } from "@shared/schema";

export function HomePage() {
  const { user, logout } = useAuth();
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>();

  const handleDive = (topic: Topic, category?: Category) => {
    setSelectedTopic(topic);
    setSelectedCategory(category);
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setSelectedCategory(undefined);
  };

  return (
    <div className="min-h-screen bg-background">
      <SideNav />

      <div className="md:pl-16">
        <header className="fixed top-0 right-0 z-40 p-4 md:hidden flex items-center justify-between w-full bg-background/50 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Synapse</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu-mobile">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.profileImageUrl || undefined} />
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => logout()} data-testid="button-logout-mobile">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="hidden md:flex fixed top-4 right-4 z-40 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" data-testid="button-user-menu">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.profileImageUrl || undefined} />
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => logout()} data-testid="button-logout">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <main className="pb-20 md:pb-0">
          <AnimatePresence mode="wait">
            {selectedTopic ? (
              <RabbitHole
                key="rabbit-hole"
                topic={selectedTopic}
                category={selectedCategory}
                onBack={handleBack}
              />
            ) : (
              <NebulaFeed key="feed" onDive={handleDive} />
            )}
          </AnimatePresence>
        </main>

        <BottomNav />
      </div>
    </div>
  );
}
