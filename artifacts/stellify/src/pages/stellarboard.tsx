import { useGetStellarbBoard, getGetStellarbBoardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Star, AlertTriangle, FlaskConical } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export default function StellarBoard() {
  const { user } = useAuth();
  const isTestAccount = user?.isTestingAccount ?? false;

  const { data: boardData, isLoading } = useGetStellarbBoard(undefined, {
    query: {
      queryKey: getGetStellarbBoardQueryKey(),
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const entries = boardData?.rankings || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            StellarBoard
            {isTestAccount && (
              <Badge variant="secondary" className="ml-2 text-xs font-normal flex items-center gap-1">
                <FlaskConical className="h-3 w-3" />
                Test Mode
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-2">
            Annual discipleship fragment leaderboard.
            {isTestAccount && " Showing test accounts only."}
          </p>
        </div>
      </div>

      <Alert className="bg-primary/5 border-primary/20">
        <AlertTriangle className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary">Annual Reset Notice</AlertTitle>
        <AlertDescription>
          Fragments and streaks are reset annually on {boardData?.lastReset || "January 1st"} to encourage consistent daily walk.
        </AlertDescription>
      </Alert>

      <Card className="border-primary/20 shadow-lg bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Top Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No stellar data available yet.
              </div>
            ) : (
              entries.map((entry: any, index: number) => {
                const isGold = index === 0;
                const isSilver = index === 1;
                const isBronze = index === 2;
                
                let rankColor = "text-muted-foreground";
                let rankBg = "bg-muted";
                
                if (isGold) {
                  rankColor = "text-yellow-600 dark:text-yellow-400";
                  rankBg = "bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-500/50";
                } else if (isSilver) {
                  rankColor = "text-gray-600 dark:text-gray-300";
                  rankBg = "bg-gray-100 dark:bg-gray-800 border border-gray-400/50";
                } else if (isBronze) {
                  rankColor = "text-amber-700 dark:text-amber-500";
                  rankBg = "bg-amber-100 dark:bg-amber-900/30 border border-amber-600/50";
                }

                return (
                  <div 
                    key={entry.churchId} 
                    className={`flex items-center justify-between p-4 rounded-lg transition-all ${isGold ? 'shadow-md scale-[1.02] bg-background' : 'bg-background hover:bg-muted/50'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${rankBg} ${rankColor}`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-mono font-medium text-lg">{entry.churchId}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            {entry.stellarStatus}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            🔥 {entry.currentStreak} day streak
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-2xl font-bold text-primary">
                        {entry.stellarFragments} <Star className="h-5 w-5 fill-primary" />
                      </div>
                      <p className="text-xs text-muted-foreground">Fragments</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
