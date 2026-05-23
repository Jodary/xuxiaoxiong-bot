import { NextRequest, NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase/route-client";
import { createServiceClient } from "@/lib/supabase/service";

export async function GET(req: NextRequest) {
  // 必须登录
  const routeClient = createRouteClient(req);
  const { data: authData } = await routeClient.auth.getUser();
  const user = authData?.user;
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 查所有 bots
  const { data: allBots, error } = await supabase
    .from("bots")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!allBots || allBots.length === 0) {
    return NextResponse.json([]);
  }

  // 筛选候选 bot
  const myBotIds = new Set<string>();        // 私人、定制（自己创建）
  const permittedBotIds = new Set<string>();  // 定制（被授权）
  const relatedPublicIds = new Set<string>(); // 公开（已聊过）

  for (const bot of allBots) {
    if (bot.creator_id === user.id) {
      // 自己创建的：私人/定制/公开 都算
      if (bot.visibility === "public") {
        relatedPublicIds.add(bot.id);
      } else {
        myBotIds.add(bot.id);
      }
    } else if (
      bot.visibility === "specific_users" &&
      bot.published &&
      user.email
    ) {
      permittedBotIds.add(bot.id);
    }
  }

  // 查定制 bot 的权限
  if (permittedBotIds.size > 0) {
    const { data: perms } = await supabase
      .from("bot_permissions")
      .select("bot_id")
      .in("bot_id", Array.from(permittedBotIds))
      .eq("allowed_email", user.email!);

    if (perms) {
      for (const p of perms) {
        myBotIds.add(p.bot_id); // 移入可看集合
      }
    }
  }

  // 查已聊过的公开 bot（非自己创建的）
  const candidatePublic = allBots.filter(
    (b) =>
      b.visibility === "public" &&
      b.published &&
      b.creator_id !== user.id
  );

  if (candidatePublic.length > 0) {
    const { data: relations } = await supabase
      .from("user_bot_relations")
      .select("bot_id")
      .eq("user_id", user.id)
      .in(
        "bot_id",
        candidatePublic.map((b) => b.id)
      );

    if (relations) {
      for (const r of relations) {
        relatedPublicIds.add(r.bot_id);
      }
    }
  }

  // 合并结果
  const visibleIds = new Set([
    ...myBotIds,
    ...relatedPublicIds,
  ]);

  const filtered = allBots.filter((bot) => visibleIds.has(bot.id));

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 用 cookie 客户端获取真实用户信息
    const routeClient = createRouteClient(req);
    const { data: authData } = await routeClient.auth.getUser();
    const user = authData?.user;
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    // 用 Service Role 客户端写入
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    const { data, error } = await supabase
      .from("bots")
      .insert({
        name: body.name,
        avatar_url: body.avatar_url || null,
        gender: body.gender || null,
        age: body.age || null,
        relationship: body.relationship || null,
        personality: body.personality,
        speaking_style: body.speakingStyle,
        forbidden_behaviors: body.forbiddenBehaviors || null,
        system_prompt: body.systemPrompt,
        category: body.category,
        visibility: body.visibility,
        published: true,
        creator_id: user.id,
      })
      .select("id, slug")
      .single();

    if (error) {
      console.error("[POST /api/bots] Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 权限表：创建者邮箱 + 指定用户邮箱
    const emailsToInsert = new Set<string>();
    if (user.email) emailsToInsert.add(user.email);
    if (body.allowedEmails?.length > 0) {
      body.allowedEmails.forEach((email: string) => emailsToInsert.add(email));
    }

    if (emailsToInsert.size > 0) {
      await supabase.from("bot_permissions").insert(
        Array.from(emailsToInsert).map((email: string) => ({
          bot_id: data.id,
          allowed_email: email,
        }))
      );
    }

    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[POST /api/bots] crash:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const botId = searchParams.get("id");

  if (!botId) {
    return NextResponse.json({ error: "Missing bot id" }, { status: 400 });
  }

  const routeClient = createRouteClient(req);
  const { data: authData } = await routeClient.auth.getUser();
  const user = authData?.user;
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // 验证创建者身份
  const { data: bot } = await supabase
    .from("bots")
    .select("creator_id")
    .eq("id", botId)
    .single();

  if (!bot) {
    return NextResponse.json({ error: "Bot 不存在" }, { status: 404 });
  }
  if (bot.creator_id !== user.id) {
    return NextResponse.json({ error: "无权删除" }, { status: 403 });
  }

  const { error } = await supabase.from("bots").delete().eq("id", botId);

  if (error) {
    console.error("[DELETE /api/bots] error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
