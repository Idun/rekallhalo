
# 主角光环 (Protagonist Halo) - 沉浸式 AI 互动小说引擎 v2.5

## 📖 项目概述
**主角光环** 是一款基于 **Google Gemini** 大模型驱动的新一代互动小说引擎。它超越了传统的文字冒险游戏，构建了一个集成了**实时多模态生成**、**无限平行宇宙管理**、**动态情感羁绊**与**沉浸式视听特效**的完整世界模拟器。

作为“主角”，你不仅是故事的经历者，更是世界的缔造者。AI 作为“地下城主（DM）”将实时响应你的每一个意图，生成逻辑严密且充满惊喜的剧情、画面与音效。

---

## ✨ 核心特性 (v2.5)

### 1. 🧠 深度 AI 叙事与文学架构
*   **双模态输入**：支持传统的**选项决策**（Choice Mode）与高自由度的**自然语言输入**（Text Mode）。
*   **文学叙事架构配置**：在开局时可指定 **10种叙事结构**（如复线型、辐射型、蛛网型）和 **6种高级叙事手法**（如非线性叙事、嵌套式叙事、打破第四面墙），让 AI 不仅写故事，更是在进行文学创作。
*   **长时记忆管理 (RAG)**：内置分层记忆系统，分为`记忆区`（Context Window）、`剧情记忆`（摘要）、`长期记忆`（归档）、`核心记忆`（不可变事实）及`物品清单`。
*   **上帝模式 (God Mode)**：提供“全局查找替换”工具，允许玩家直接修正 AI 的记忆偏差或批量修改剧情设定，不仅是玩游戏，更是写书。

### 2. 🎬 导演模式：伏笔与预设事件系统
*   **预设事件队列 (Scheduled Events)**：玩家可随时化身为“导演”，预设未来将要发生的事件（如“下一章遭遇宿敌”、“在酒馆偶遇神秘人”）。
*   **AI 智能编排**：AI 会读取预设队列，并尝试将其**自然地**融入当前剧情节奏中，避免生硬转折。
*   **叙事手法融合**：当预设事件与“非线性叙事”等手法结合时，AI 可能会以倒叙、预知梦或侧面描写的方式来呈现该事件，极大地丰富了表现力。

### 3. 🎨 极致的视觉体验与镜头语言
*   **电影级镜头调度 (Cinematic Camera)**：系统能自动解析剧情中的视觉提示词（Visual Prompt），智能识别 **Shot Size**（景别）：
    *   *特写 (Close-up)*：缓慢推近，聚焦情感。
    *   *远景 (Long Shot)*：缓慢平移，展现宏大场景。
    *   *动态透视 (Dynamic)*：应用鱼眼或大透视效果增强冲击力。
*   **混合生图引擎 (Hybrid Generation)**：
    *   **Google Gemini**: 用于高精度角色与关键帧生成。
    *   **Pollinations.ai**: 用于生成“无限流”动态背景（Smart Background），确保场景永远不重复且无需消耗 Key 配额。
    *   **ModelScope / FLUX**: 支持接入国内模型源进行高质量渲染。
*   **动态视觉特效层**: `VisualEffectsLayer` 根据剧情关键词（如“雷霆”、“治疗”、“黑暗”）自动触发粒子特效。

### 4. ♾️ 时空回廊 (Save System)
*   **节点图可视化 (Canvas Tree)**：采用 SVG 与 HTML 混合渲染的**无限存档树**，直观展示所有命运分支。支持**鼠标拖拽、缩放**，玩家可以像观测者一样俯瞰整个时间线。
*   **无缝回溯与分支**：随时点击任意历史节点，瞬间穿越回那个时刻，开辟新的平行宇宙。
*   **数据导入导出**：支持导出完整存档或仅导出“世界观配置”JSON，方便社区分享设定。

### 5. ❤️ 沉浸式角色系统
*   **动态立绘与垫图**：支持上传参考图（Ref Image）固定画风，AI 根据外貌描述实时生成角色头像。
*   **原型系统 (Archetypes)**：引入荣格心理学原型（如“导师”、“阴影”、“变形者”），赋予 NPC 更深层的行为逻辑。
*   **好感度可视化**：AI 实时分析交互，动态调整 NPC 好感度，并在 UI 上以可视化进度条呈现。

---

## 📂 项目文件结构图解

*   `services/`
    *   `geminiService.ts`: **(核心大脑)** 负责所有与 Google Gemini API 的通信，包括 Prompt 构建、JSON 清洗、降级策略及 Tool Calling。
*   `hooks/`
    *   `useGameEngine.ts`: **(心脏与状态机)** 管理游戏的主循环、状态流转（Setup -> Playing -> Loading）、自动存档、音频调度及全局 UI 状态。
*   `components/`
    *   `screens/`: 顶级页面组件（`GameScreen`, `SetupScreen`, `LandingScreen`, `LoadGameScreen`）。
    *   `modals/`: 弹窗系统（`SystemModals` 包含画廊/设置, `GameplayModals` 包含历史/角色详情）。
    *   `VisualEffectsLayer.tsx`: Canvas 粒子特效层。
    *   `TypingText.tsx`: 核心打字机组件，包含实体识别与高亮逻辑。
    *   `SmoothBackground.tsx`: 双缓冲背景切换组件。
*   `types.ts`: 全局 TypeScript 类型定义。
*   `constants.ts`: 静态配置，包含叙事架构定义、世界观预设文本等。

---

## 🛠️ 技术栈详情

*   **前端框架**: React 19 (利用最新的 Hooks 模式)
*   **语言**: TypeScript (全类型覆盖，包括 Gemini SDK 类型定义)
*   **样式**: Tailwind CSS (大量使用 `backdrop-blur`, `animate`, `clip-path` 等高级特性实现 Glassmorphism 和 Cassette Futurism 风格)
*   **AI SDK**: Google GenAI SDK (Gemini 2.5/3.0 Models)
*   **图形**: HTML5 Canvas (用于粒子特效) + SVG (用于连接线绘制)

## 📦 快速开始

1.  **配置环境**: 确保拥有 Google Gemini API Key。
2.  **启动应用**:
    *   进入首页，点击“系统设置”。
    *   在“AI 模型配置”中填入 API Key（若未通过环境变量注入）。
    *   (可选) 配置 ModelScope Key 以获得更好的绘图体验。
3.  **开启旅程**:
    *   点击“开启新人生”。
    *   填写主角设定，或粘贴一段小说大纲点击“智能解析”。
    *   点击“启动体验”，等待世界生成。

## 🚀 部署与开发指南

### 💻 本地开发 (Local Development)

1.  **环境准备**
    *   Node.js (建议 v18+)
    *   npm 或 yarn

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **配置环境变量**
    在项目根目录创建 `.env` 文件，填入你的 API Key：
    ```env
    API_KEY=your_google_gemini_api_key_here
    # 可选：ModelScope Key 用于增强绘图
    # VITE_MODELSCOPE_KEY=your_key_here
    ```

4.  **启动项目**
    ```bash
    npm start
    # 或 npm run dev
    ```

### 🌐 在线部署 (Online Deployment)

推荐使用 **Vercel** 或 **Netlify** 进行零配置部署。

1.  将代码推送到 GitHub 仓库。
2.  在 Vercel 中导入该仓库。
3.  **关键步骤**：在部署配置页面的 **Environment Variables** 中添加：
    *   `API_KEY`: 你的 Google Gemini API Key
4.  点击 Deploy，等待构建完成即可访问。

## ⚠️ 注意事项
*   **API 配额**: 频繁生图可能消耗大量 Token，建议在设置中按需调整模型版本。
*   **数据存储**: 所有存档均存储在浏览器 `LocalStorage` 中。清理浏览器缓存会导致存档丢失，请定期使用“导出存档”功能备份。
