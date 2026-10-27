import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-4" data-testid="page-not-found">
        <p className="text-6xl font-bold text-primary">404</p>
        <h1 className="text-2xl font-semibold">We couldn't find that page</h1>
        <p className="text-sm text-muted-foreground">
          The link may be broken, or the page may have moved. Your courses are safe — pick up where you left off.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/">
            <Button>
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
          </Link>
          <Link href="/explore">
            <Button variant="outline">
              <Compass className="mr-2 h-4 w-4" />
              Explore topics
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
