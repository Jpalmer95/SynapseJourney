import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch, Link } from "wouter";
import { RabbitHole } from "@/components/rabbit-hole";
import { AppLayout } from "@/components/app-layout";
import { Loader2, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Topic, Category } from "@shared/schema";

export function RabbitHolePage() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const topicId = params.get("topic");

  const { data: topic, isLoading: topicLoading, error: topicError } = useQuery<Topic>({
    queryKey: ["/api/topics", topicId],
    enabled: !!topicId,
  });

  const { data: category } = useQuery<Category>({
    queryKey: ["/api/categories", topic?.categoryId],
    enabled: !!topic?.categoryId,
  });

  const handleBack = () => {
    navigate("/map");
  };

  if (!topicId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <div>
                <h2 className="text-xl font-semibold mb-2">No Topic Selected</h2>
                <p className="text-muted-foreground">
                  Please select a topic from the Knowledge Map to explore.
                </p>
              </div>
              <Link href="/map">
                <Button className="w-full" data-testid="button-go-to-map">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go to Knowledge Map
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (topicLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading topic...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (topicError || !topic) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[calc(100vh-8rem)] p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center space-y-4">
              <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
              <div>
                <h2 className="text-xl font-semibold mb-2">Topic Not Found</h2>
                <p className="text-muted-foreground">
                  We couldn't find this topic. It may have been removed or the link is invalid.
                </p>
              </div>
              <Link href="/map">
                <Button className="w-full" data-testid="button-back-to-map">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Knowledge Map
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showMobileHeader={false}>
      <RabbitHole 
        topic={topic} 
        category={category} 
        onBack={handleBack} 
      />
    </AppLayout>
  );
}

export default RabbitHolePage;
