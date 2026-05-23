# 许小熊 Bot

个性化 AI 伙伴创建与对话平台。用户可以创建定制 AI Bot（配置人格、语气、类别、纪念日、爱好等），选择公开/私人/指定用户分享，通过智谱 GLM 模型与 Bot 实时对话。支持 Bot 记忆功能和对话上下文记忆，刷新页面或重新打开后自动恢复历史对话。

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 16 (App Router) + React 19 |
| 样式 | Tailwind CSS 4 + shadcn/ui |
| 数据库 | Supabase (PostgreSQL + Auth + RLS) |
| AI 模型 | 智谱 GLM-4-Flash (OpenAI 兼容接口) |
| 部署 | Netlify (Edge Functions) |

## 项目结构

```
src/
├── app/
│   ├── page.tsx                      # 首页（未登录 → CTA，已登录 → 跳转聊天）
│   ├── layout.tsx                    # 根布局（字体、AuthProvider、Toaster）
│   ├── globals.css                   # Tailwind + shadcn 主题变量
│   ├── not-found.tsx                 # 全局 404 页面
│   │
│   ├── auth/
│   │   ├── login/page.tsx            # 登录页
│   │   └── register/page.tsx         # 注册页
│   │
│   ├── chat/
│   │   └── page.tsx                  # 我的 Bot（需登录），3 类 Tab：定制/私人/公开
│   │
│   ├── market/
│   │   └── page.tsx                  # Bot 市场（需登录），展示所有公开 Bot
│   │
│   ├── bot/[slug]/
│   │   ├── page.tsx                  # Bot 对话页（动态路由），权限校验
│   │   ├── ChatWrapper.tsx           # 客户端包装组件，连接 ChatInterface
│   │   └── not-found.tsx             # Bot 不存在时的提示页
│   │
│   ├── builder/start/
│   │   └── page.tsx                  # Bot 创建向导（5 步：身份→类型→基础→高级→发布）
│   │
│   └── api/
│       ├── bots/
│       │   ├── route.ts              # GET（权限过滤）/ POST（创建）
│       │   ├── market/route.ts       # GET 所有公开 Bot
│       │   └── relation/route.ts     # GET/PATCH/POST 用户-Bot 关联与记忆
│       └── chat/route.ts             # 聊天 API（SSE 流式，调用智谱模型）
│
├── components/
│   ├── auth/AuthForm.tsx             # 登录/注册表单组件
│   ├── builder/
│   │   ├── WizardProgress.tsx        # 创建向导进度条（5 步）
│   │   ├── Step1Identity.tsx         # 步骤1：选择用户身份
│   │   ├── Step2BotType.tsx          # 步骤2：选择 Bot 类别
│   │   ├── Step3Customize.tsx        # 步骤3：基础设定（名字、性格、语气）必填
│   │   ├── Step4Advanced.tsx         # 步骤4：高级定制（纪念日、爱好、FAQ）选填
│   │   ├── Step4Visibility.tsx       # 步骤5：设置可见性 + 授权邮箱
│   │   └── BotPreview.tsx            # 实时预览 Bot 卡片
│   ├── chat/
│   │   └── ChatInterface.tsx         # 聊天界面（消息 + SSE 流式 + 记忆编辑）
│   └── ui/                           # shadcn/ui 基础组件库
│
├── lib/
│   ├── bot-types.ts                  # Bot 表单类型定义 + 选项常量
│   ├── prompt-generator.ts           # 根据表单生成 system prompt
│   ├── hooks/use-auth.tsx            # Auth Context + useAuth hook
│   └── supabase/
│       ├── client.ts                 # 浏览器端 Supabase 客户端
│       ├── server.ts                 # Server Component 端客户端
│       ├── route-client.ts           # Route Handler 端客户端
│       └── service.ts                # Service Role 客户端（绕过 RLS，仅后端用）
│
├── proxy.ts                          # Next.js 中间件（保护 /builder 路由，刷新 session）
├── scripts/predev.js                 # 开发前检查脚本
├── supabase-schema.sql               # 完整数据库 Schema + RLS 策略
├── netlify.toml                      # Netlify 部署配置
└── .env.local                        # 本地环境变量（不入 git）
```

## 数据库表

| 表 | 用途 |
|----|------|
| `profiles` | 用户扩展信息（关联 auth.users），注册时自动创建 |
| `bots` | Bot 数据（名称、人格、可见性、slug 等），通过 `creator_id` 关联创建者 |
| `bot_permissions` | 定制 Bot 的授权邮箱白名单，创建时自动写入创建者 + 指定用户 |
| `user_bot_relations` | 用户与公开 Bot 的关联关系 + 记忆备注（首次对话自动建立） |
| `chat_sessions` | 聊天会话记录 |
| `messages` | 聊天消息记录 |

## Bot 可见性

| 类型 | 谁能看到和使用 |
|------|---------------|
| 私人 (`private`) | 仅创建者自己 |
| 定制 (`specific_users`) | 创建者 + 指定邮箱的用户 |
| 公开 (`public`) | 所有登录用户（首次对话后出现在「我的 Bot」中） |

权限在 **应用层** 做显式过滤（`src/app/api/bots/route.ts` 的 GET 方法 + `src/app/bot/[slug]/page.tsx`），不依赖 Supabase RLS 的 cookie 传递，避免 Netlify Edge 环境下 cookie 读取不可靠的问题。

## Bot 记忆

### 手动记忆

每个用户可以对使用的 Bot 设置独立的记忆备注，Bot 会在对话中自然引用。记忆按 `user_id + bot_id` 隔离，互不影响。

- 对话页顶部点 📖 图标展开记忆编辑框
- 输入生日、爱好、重要事件等信息
- 保存后 Bot 立即在对话中生效
- 底层 system prompt 不受影响，记忆仅作为追加上下文

### 自动记忆（Function Calling）

Bot 会在对话中自动识别值得记住的用户信息（如生日、喜好、经历等），通过 `save_memory` function calling 写入数据库。下次对话时这些信息会自动注入 system prompt。

### 对话上下文记忆

每次对话的消息历史会自动保存到数据库。刷新页面或关闭后重新打开同一个 Bot 的对话窗口，会自动加载最近 50 条历史消息，恢复完整上下文，让 Bot 记住你们聊过什么。

## API 路由

| 端点 | 方法 | 用途 | 认证 |
|------|------|------|------|
| `/api/bots` | GET | 获取个人可见的 Bot（私人+定制+已关联公开） | Cookie Session |
| `/api/bots` | POST | 创建新 Bot | Cookie Session |
| `/api/bots/market` | GET | 获取所有公开 Bot | Cookie Session |
| `/api/bots/relation` | GET | 读取用户对某 Bot 的记忆 | Cookie Session |
| `/api/bots/relation` | PATCH | 更新用户对某 Bot 的记忆 | Cookie Session |
| `/api/bots/relation` | POST | 建立用户-Bot 关联（首次对话） | Cookie Session |
| `/api/chat` | GET | 获取历史消息（恢复对话上下文） | Cookie Session |
| `/api/chat` | POST | SSE 流式对话 | Cookie Session |

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器（自动读取 .env.local）
npm run dev
# → http://localhost:3000
```

## 环境变量

`.env.local` 需配置以下变量：

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_KEY=<service-role-key>

# 智谱 AI（OpenAI 兼容）
OPENAI_API_KEY=<zhipu-api-key>
OPENAI_BASE_URL=https://open.bigmodel.cn/api/paas/v4
OPENAI_MODEL=glm-4-flash
```

## 部署到 Netlify

1. 将代码推送到 GitHub
2. Netlify 关联仓库，自动构建部署
3. 在 Netlify Dashboard → Site settings → Environment variables 中添加**所有**环境变量
4. 环境变量变更后需手动 **Trigger deploy**（Netlify 不会因环境变量变更自动重部署）

## 数据库初始化

1. 在 Supabase SQL Editor 中**完整执行** `supabase-schema.sql`
2. 在 Supabase Authentication → Providers 中开启 **Email/Password**

## 常见问题

**Q: 创建 Bot 报 slug 重复错误？**
A: 去 Supabase Table Editor 删掉旧 bot 数据，再重新创建。

**Q: 指定用户看不到分享的 Bot？**
A: 确认 Supabase 已执行 `supabase-schema.sql` 内的 RLS 策略，且对方登录邮箱与授权邮箱一致。

**Q: 本地调试时 API 报 "Could not find the table"？**
A: `.env.local` 中 Supabase URL/Key 指向的项目没有执行 `supabase-schema.sql` 建表。
