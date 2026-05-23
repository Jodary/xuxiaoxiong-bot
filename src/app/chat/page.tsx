"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Plus, Sparkles, Store, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BotCategory = "private" | "specific" | "relatedPublic";

interface Bot {
  id: string;
  name: string;
  slug: string;
  visibility: "private" | "specific_users" | "public";
  creator_id: string;
  category?: string;
  personality?: string;
}

export default function ChatPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [allBots, setAllBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<BotCategory>("specific");
  const [deleteTarget, setDeleteTarget] = useState<Bot | null>(null);
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  const loadBots = useCallback(async () => {
    try {
      const res = await fetch("/api/bots");
      if (res.ok) {
        setAllBots(await res.json());
      }
    } catch {
      setAllBots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    loadBots();
  }, [user, authLoading, router, loadBots]);

  const handleDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/bots?id=${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setAllBots((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      }
    } catch {
      // 删除失败，静默处理
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  // 分组
  const privateBots = allBots.filter(
    (b) => b.visibility === "private" && b.creator_id === user?.id
  );
  const specificBots = allBots.filter(
    (b) => b.visibility === "specific_users"
  );
  const relatedPublicBots = allBots.filter(
    (b) => b.visibility === "public"
  );

  // 自动选中第一个非空 tab
  useEffect(() => {
    if (specificBots.length > 0) setTab("specific");
    else if (privateBots.length > 0) setTab("private");
    else if (relatedPublicBots.length > 0) setTab("relatedPublic");
  }, [specificBots.length, privateBots.length, relatedPublicBots.length]);

  const currentBots =
    tab === "private"
      ? privateBots
      : tab === "specific"
      ? specificBots
      : relatedPublicBots;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50/50 to-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">我的 Bot</h1>
            <p className="text-muted-foreground text-sm">
              管理和对话你的 AI 伙伴
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/market")}
            >
              <Store className="w-4 h-4 mr-1" />
              市场
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/builder/start")}
            >
              <Plus className="w-4 h-4 mr-1" />
              创建
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as BotCategory)} className="mb-6">
          <TabsList>
            <TabsTrigger value="specific">
              定制 ({specificBots.length})
            </TabsTrigger>
            <TabsTrigger value="private">
              私人 ({privateBots.length})
            </TabsTrigger>
            <TabsTrigger value="relatedPublic">
              公开 ({relatedPublicBots.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Bot List */}
        {currentBots.length === 0 ? (
          <Card className="p-12 text-center space-y-4">
            <div className="text-4xl">🤖</div>
            <div className="text-muted-foreground">
              {tab === "private"
                ? "还没有私人的 Bot"
                : tab === "specific"
                ? "还没有定制的 Bot"
                : "还没有公开 Bot，去市场看看吧"}
            </div>
            <Button onClick={() => router.push(tab === "relatedPublic" ? "/market" : "/builder/start")}>
              <Sparkles className="w-4 h-4 mr-1" />
              {tab === "relatedPublic" ? "去市场" : "创建 Bot"}
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentBots.map((bot) => (
              <Card
                key={bot.id}
                className="p-4 cursor-pointer hover:shadow-md transition-all"
                onClick={() => router.push(`/bot/${bot.slug}`)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {(bot.name || "AI").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{bot.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {bot.category || "custom"}
                    </div>
                  </div>
                  <Badge variant={bot.visibility === "public" ? "default" : "secondary"} className="text-xs">
                    {bot.visibility === "public" ? "公开" : bot.visibility === "private" ? "私人" : "定制"}
                  </Badge>
                </div>
                {bot.personality && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {bot.personality}
                  </p>
                )}
                {bot.creator_id === user?.id && (
                  <div className="mt-2 flex justify-end items-center gap-3">
                    <span
                      className="text-xs text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/bot/${bot.slug}/dashboard`)
                      }}
                    >
                      📊 仪表盘
                    </span>
                    <button
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget(bot);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                      删除
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除「{deleteTarget?.name}」吗？此操作不可撤销，所有对话记录和关联数据将被永久删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              className="px-3 py-1.5 text-sm rounded-md border hover:bg-muted"
              onClick={() => setDeleteTarget(null)}
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
