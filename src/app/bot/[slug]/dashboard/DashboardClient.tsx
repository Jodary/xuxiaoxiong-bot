    "use client";

    import { useState } from "react";
    import { useRouter } from "next/navigation";
    import { Button } from "@/components/ui/button";
    import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
    import { StatsCards } from "@/components/dashboard/StatsCards";
    import { EmotionChart } from "@/components/dashboard/EmotionChart";
    import { KeywordCloud } from "@/components/dashboard/KeywordCloud";
    import { SessionList } from "@/components/dashboard/SessionList";
    import type { AnalyticsStats } from "@/lib/analytics";

    interface DashboardClientProps {
      botName: string;
      botId: string;
      initialStats: AnalyticsStats | null;
    }

    export function DashboardClient({ botName, botId, initialStats }: DashboardClientProps) {
      const router = useRouter();
      const [stats, setStats] = useState<AnalyticsStats | null>(initialStats);
      const [loading, setLoading] = useState(false);
      const [showDeleteDialog, setShowDeleteDialog] = useState(false);
      const [deleting, setDeleting] = useState(false);

      const handleDelete = async () => {
        if (deleting) return;
        setDeleting(true);
        try {
          const res = await fetch(`/api/bots?id=${botId}`, { method: "DELETE" });
          if (res.ok) {
            router.push("/chat");
          }
        } catch {
          setDeleting(false);
        }
      };

      const refresh = async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/analytics/stats?botId=${botId}&days=30`);
          if (!res.ok) throw new Error("加载失败");
          const data = await res.json();
          setStats(data);
        } catch {
          setStats(null);
        } finally {
          setLoading(false);
        }
      };

      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50/50 to-white">
          <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  返回
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">{botName} 的仪表盘</h1>
                  <p className="text-muted-foreground text-sm">
                    查看用户互动数据和情绪状态
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  删除 Bot
                </Button>
                <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                  刷新
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-20 text-muted-foreground">
                加载中...
              </div>
            ) : !stats ? (
              <div className="text-center py-20 text-muted-foreground">
                加载统计失败，请重试
              </div>
            ) : (
              <>
                {/* 概览卡片 */}
                <StatsCards
                  totalUsers={stats.overview.totalUsers}
                  totalSessions={stats.overview.totalSessions}
                  totalMessages={stats.overview.totalMessages}
                  avgEmotionScore={stats.overview.avgEmotionScore}
                />

                {/*图表区域：两列布局*/}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <EmotionChart dailyStats={stats.dailyStats} />
                  <KeywordCloud
                    keywords={
                      stats.dailyStats?.length > 0
                        ? stats.dailyStats[stats.dailyStats.length - 1].topKeywords || []
                        : []
                    }
                  />
                </div>

                {/* 最近对话 */}
                <SessionList sessions={stats.recentSessions || []} />
              </>
            )}
          </div>

        {/* 删除确认弹窗 */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
              <DialogDescription>
                确定要删除「{botName}」吗？此操作不可撤销，所有对话记录和关联数据将被永久删除。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
              >
                取消
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "删除中..." : "确认删除"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      );
    }
