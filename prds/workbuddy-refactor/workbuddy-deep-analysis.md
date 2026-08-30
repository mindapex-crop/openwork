# WorkBuddy UI Deep Analysis & Replication Plan

## Methodology

Analyzed all 21 WorkBuddy screenshots from `~/Desktop/workbuddy/`. Each page has been:
1. Identified by module name and Chinese label
2. Analyzed for layout, color, typography, and components
3. Mapped to OpenWork's existing modules
4. Gap analysis performed

---

## Page 1: 首页/主界面 (AI Assistant Home)

### Screenshot
`screenshot-20260826-232938.png`, `screenshot-20260826-232955.png`

### Layout
- Three-panel: left sidebar + main content + right floating promo
- Top bar: view mode, search, filter, "做任务赢积分好礼 >" CTA
- Main content: "WorkBuddy, 我帮你" heading, category tabs (日常办公/代码开发/设计创意), pill buttons (文档处理/金融服务/...), AI input panel
- Right floating: Activity promo card with "免费体验" button

### Key Components
- **Category Tabs**: Pill buttons with active state (dark gray bg)
- **AI Input Panel**: Bottom dock with @mentions, /skills, Auto, mic, send
- **Promotional Card**: Light green bg, "×" dismiss, CTA button

### OpenWork Status
- ✅ Session page exists with similar layout
- ⚠️ Missing: promotional card, category tabs with pill buttons
- ⚠️ Different: OpenWork uses Ask/Plan/Craft instead of category tabs

### Replication Plan
1. Add category pill buttons below the "WorkBuddy, 我帮你" heading
2. Add promotional card component (dismissible)
3. Keep Ask/Plan/Craft as secondary task mode selector

---

## Page 2: 项目 (Projects Dashboard)

### Screenshot
`screenshot-20260826-233125.png`

### Layout
- Header: "项目" title, "多人协同，打造超级团队" subtitle, "+ 新建项目" button, illustration
- Search bar: "搜索项目" in top-right
- "我的项目" section: horizontal scrollable project cards
- "从模版创建" section: 2x4 grid of template cards

### Key Components
- **Project Cards**: Network icon, name, "添加于 X 天前", "⋯" menu
- **Template Cards**: Icon, name, description
- **Illustration**: Line art of team collaboration

### OpenWork Status
- ✅ Projects page exists with card grid
- ⚠️ Missing: illustration, template cards section
- ⚠️ Different: OpenWork uses different card design

### Replication Plan
1. Add illustration to projects page header
2. Add "从模版创建" section with template cards
3. Update project card design to match WorkBuddy style

---

## Page 3: 项目详情/动态 (Project Activity)

### Screenshot
`screenshot-20260826-233145.png`

### Layout
- Three-panel: left sidebar, main content, right config panel
- Tabs: 动态/计划/任务/资产
- Activity feed: "发布留言" button, "与我相关" filter, "成员动态" filter
- Bot onboarding message with structured content
- Bottom AI input panel
- Right panel: Project config (指令/连接器/专家/技能/自动化)

### Key Components
- **Activity Feed**: Messages with bot avatar, structured content
- **Filters**: "与我相关", "成员动态" segmented control
- **Right Config Panel**: Collapsible sections with "+" add buttons
- **AI Input Panel**: Bottom dock with @mentions, permissions, Auto, mic

### OpenWork Status
- ✅ Project detail exists with tabs
- ⚠️ Missing: right config panel with collapsible sections
- ⚠️ Different: OpenWork right panel shows artifacts/browser

### Replication Plan
1. Add right project configuration panel with collapsible sections
2. Add activity feed with bot onboarding message
3. Add "与我相关"/"成员动态" filters

---

## Page 4: 项目详情/计划 (Project Plan)

### Screenshot
`screenshot-20260826-233206.png`

### Layout
- Tabs: 动态/计划/任务/资产
- View switch: 表格/看板/+ (add view)
- Toolbar: filter, search, settings, "添加" button
- Table: 标题/状态/处理人/优先级/标签 columns
- Bottom AI input panel
- Right config panel

### Key Components
- **View Switch**: Table/Kanban segmented control
- **Table**: Sortable columns, task rows
- **Right Config Panel**: Same as activity page

### OpenWork Status
- ✅ Plan tab exists
- ⚠️ Missing: table/kanban view switch
- ⚠️ Different: OpenWork uses different table design

### Replication Plan
1. Add table/kanban view switch
2. Update table design to match WorkBuddy style
3. Ensure right config panel is consistent

---

## Page 5: 项目详情/任务 (Project Tasks)

### Screenshot
`screenshot-20260826-233206.png`

### Layout
- Task list with filters (全部任务/全部来源)
- "你的任务是私密的，除非你共享它们" notice
- Search: "搜索任务标题"
- Task items: title, "本地" tag, progress (8/8), "⋯" menu
- Bottom AI input panel
- Right config panel

### Key Components
- **Task Items**: Title, green "本地" tag, progress, menu
- **Filters**: Segmented control
- **Notice**: Privacy notice

### OpenWork Status
- ✅ Tasks tab exists
- ⚠️ Missing: "本地" tag design, privacy notice
- ⚠️ Different: OpenWork task list design

### Replication Plan
1. Add "本地" green tag to tasks
2. Add privacy notice
3. Update task item design

---

## Page 6: 项目详情/资产 (Project Assets)

### Screenshot
`screenshot-20260826-233219.png`

### Layout
- Tabs: 动态/计划/任务/资产
- Toolbar: "新建文件夹", "上传文件", storage usage ("4.39 GB / 5.00 GB"), "升级" link, "全部类型" dropdown, search
- Table: 名称/类型/更新人/更新时间/大小
- File rows: folder icon (blue), PDF icon (red), metadata
- Bottom AI input panel
- Right config panel

### Key Components
- **Storage Bar**: Shows usage with "升级" CTA
- **File Table**: Sortable columns, type icons
- **File Icons**: Blue folder, red PDF

### OpenWork Status
- ✅ Assets tab exists
- ⚠️ Missing: storage usage bar with "升级" link
- ⚠️ Different: OpenWork uses different table design

### Replication Plan
1. Add storage usage bar with "升级" link
2. Update file table design
3. Add file type icons (blue folder, red PDF)

---

## Page 7: 专家 (Experts Marketplace)

### Screenshot
`screenshot-20260826-233239.png`

### Layout
- Top nav tabs: 专家/技能/连接器
- Search: "搜索专家职称或描述"
- "我的专家" button
- "精选场景" section: horizontal scrollable scenario cards
- "专家/专家团" section: grid of expert cards
- Category filters: 全部/OPC·一人公司/腾讯专家/产品设计/...
- Sort: 综合/最热/最新

### Key Components
- **Scenario Cards**: "开学季", "内容创作", "投资分析", "法律咨询", "小微企业"
- **Expert Cards**: Avatar, name, "X万次使用", tags, "⋯" menu
- **Category Filters**: Horizontal scrollable tabs

### OpenWork Status
- ✅ Experts page exists
- ⚠️ Missing: "精选场景" section, expert card design with usage count
- ⚠️ Different: OpenWork uses different card layout

### Replication Plan
1. Add "精选场景" section with scenario cards
2. Update expert card design with usage count
3. Add horizontal category filter tabs

---

## Page 8: 专家详情弹窗 (Expert Detail Modal)

### Screenshot
`screenshot-20260826-233254.png`

### Layout
- Modal overlay on top of experts page
- Expert info: avatar, name, "182.83万次使用", "召唤专家" CTA
- Description text
- Tags: 工作台搭建/响应式网页/个人效率工具
- "专家帮你做" section: example requests
- "使用案例" section: preview images

### Key Components
- **Usage Count**: "X万次使用" display
- **召唤 Expert CTA**: Black button
- **Example Requests**: Clickable text boxes
- **Preview Images**: Use case screenshots

### OpenWork Status
- ⚠️ Missing: Expert detail modal
- ⚠️ Different: OpenWork navigates to expert page instead of modal

### Replication Plan
1. Create expert detail modal component
2. Add "召唤专家" CTA button
3. Add "专家帮你做" example requests
4. Add "使用案例" preview images

---

## Page 9: 技能 (Skills Marketplace)

### Screenshot
`screenshot-20260826-233323.png`

### Layout
- Top nav tabs: 专家/技能/连接器
- Search: "搜索技能"
- "我安装的 10" button, "添加技能" button
- "换一换" refresh button
- "精选技能" section: horizontal scrollable skill cards
- "推荐 SkillHub 套件" section: grid of skill cards
- Category tabs: 全部/办公协同/开发工具/投资理财/...

### Key Components
- **Skill Cards**: Icon, name, description, "+" add button
- **Category Tabs**: Horizontal scrollable
- **Refresh**: "换一换" button for featured skills

### OpenWork Status
- ✅ Skills marketplace exists
- ⚠️ Missing: "换一换" refresh button
- ⚠️ Different: OpenWork uses different card design

### Replication Plan
1. Add "换一换" refresh button
2. Update skill card design
3. Ensure category tabs are horizontal scrollable

---

## Page 10: 连接器 (Connectors)

### Screenshot
`screenshot-20260826-233334.png`

### Layout
- Top nav tabs: 专家/技能/连接器
- Search: "搜索连接器"
- "自定义连接器" button
- Grid: 4 columns of connector cards
- Each card: icon, name, description, "+" add button, status (green dot)

### Key Components
- **Connector Cards**: Brand icon, name, description, add button
- **Status Indicators**: Green dot for active/connected
- **Custom Connector**: "自定义连接器" button

### OpenWork Status
- ✅ Connectors page exists
- ⚠️ Missing: 4-column grid layout, green status dots
- ⚠️ Different: OpenWork uses different layout

### Replication Plan
1. Update to 4-column grid layout
2. Add green status dots for connected connectors
3. Add "自定义连接器" button

---

## Page 11: 自动化 (Automations List)

### Screenshot
`screenshot-20260826-233345.png`

### Layout
- Tabs: 定时任务/运行记录
- Toolbar: "搜索自动化/记录", "批量管理", "从模版添加", "+ 添加自动化"
- Task list: "当前" section with task items
- Task items: name, trigger (每6小时/每周周日08:00/每天07:00), next run time, status
- Right config panel

### Key Components
- **Task Items**: Name, trigger rule, next run time, status
- **Status Colors**: Gray (pending), red (interrupted)
- **Add Buttons**: "从模版添加", "+ 添加自动化"

### OpenWork Status
- ✅ Automations page exists (FIXED route guard)
- ⚠️ Missing: task item design with trigger rule and next run
- ⚠️ Different: OpenWork uses different list design

### Replication Plan
1. Update task item design with trigger rule and next run
2. Add status colors (gray/red)
3. Ensure "从模版添加" and "+ 添加自动化" buttons

---

## Page 12: 自动化/编辑 (Automation Editor)

### Screenshot
`screenshot-20260826-233358.png`

### Layout
- Three-panel: left sidebar, main form, right run history
- Form fields: 名称, 工作空间, 提示词 (Markdown), 连接器, 执行频率, 生效日期区间, 推送目标
- Right panel: "运行历史 (19)" with timestamps and status icons
- Bottom: "取消" and "保存" buttons

### Key Components
- **Form Fields**: Name, workspace, prompt (Markdown editor), connectors, frequency, date range, push targets
- **Markdown Editor**: With syntax highlighting, tool buttons
- **Run History**: Timestamps with ✓/❗ status icons
- **Notification Banner**: "自动化任务执行时，请勿关闭电脑..."

### OpenWork Status
- ✅ Automation editor exists
- ⚠️ Missing: right run history panel, notification banner
- ⚠️ Different: OpenWork form design differs

### Replication Plan
1. Add right run history panel
2. Add notification banner
3. Update form design to match WorkBuddy

---

## Page 13: 资料库 (Library)

### Screenshot
`screenshot-20260826-233413.png`

### Layout
- Left sidebar: "资料库" with search, recent, local files, "我的资料", "团队空间"
- Main content: Tabs: 最近访问/我分享的/与我共享
- Table: 名称/所有者/位置/最近访问
- "了解资料库" section: Info cards
- "资料库的100种用法" section: Horizontal carousel

### Key Components
- **Sidebar Navigation**: Recent, local, my resources, team spaces
- **Tabs**: Recently accessed, shared by me, shared with me
- **Info Cards**: "一分钟玩转资料库", "Workbuddy资料库介绍"
- **Carousel**: "资料库的100种用法" with horizontal scroll

### OpenWork Status
- ✅ Library page exists with tabs
- ⚠️ Missing: left sidebar navigation, info cards, carousel
- ⚠️ Different: OpenWork uses different layout

### Replication Plan
1. Add left sidebar navigation to library
2. Add "了解资料库" info cards
3. Add "资料库的100种用法" carousel

---

## Page 14: 灵感 (Inspiration Templates)

### Screenshot
`screenshot-20260826-233452.png`

### Layout
- Header: "灵感" title, "常见工作流沉淀成可复用的任务起点" subtitle, "我的收藏" button, search
- Category tabs: 全部/精选/个人工作台/办公协同/投资理财/...
- Template cards: 2-column grid with preview screenshots
- Each card: preview image, title, description, tag (HTML/官方), heart button

### Key Components
- **Template Cards**: Preview screenshot, title, description, technology tag, favorite button
- **Category Tabs**: Horizontal scrollable
- **Preview Screenshots**: Real UI previews of templates

### OpenWork Status
- ✅ Inspiration page exists
- ⚠️ Missing: template preview screenshots, card design with heart button
- ⚠️ Different: OpenWork uses different card design

### Replication Plan
1. Add template preview screenshots to cards
2. Update card design with heart button
3. Ensure category tabs are horizontal scrollable

---

## Page 15: 任务对话 (Task Conversation with Agent Team)

### Screenshot
`screenshot-20260826-233535.png`, `screenshot-20260826-235034.png`

### Layout
- Left sidebar (narrow): Navigation
- Main content: Task description, task list with checkboxes, tool call log
- Right panel: DESIGN.md document viewer
- Bottom: AI input panel with @mentions, permissions, Auto, mic

### Key Components
- **Task List**: Checkboxes for sub-tasks (✅/🌟/○)
- **Tool Call Log**: "6 个工具调用", "已消耗 ♦ 78.25"
- **Document Viewer**: DESIGN.md with design specs, color codes, font names
- **Credits Display**: Points consumed

### OpenWork Status
- ✅ Task conversation exists
- ⚠️ Missing: task list with checkboxes, tool call log, document viewer
- ⚠️ Different: OpenWork doesn't show design spec document inline

### Replication Plan
1. Add task list with checkboxes to conversation
2. Add tool call log display
3. Add document viewer panel

---

## Page 16: 设置/系统设置 (Settings)

### Screenshot
`screenshot-20260826-235047.png`

### Layout
- Left sidebar: Settings groups (个人/集成/编码/已归档)
- Settings items: 系统设置/账户管理/智能体设置/个性化/记忆/模型/助理设置/数据管理/快捷键/安全中心/关于我们
- Right content: Settings panels

### Key Components
- **Settings Groups**: Personal/Integration/Code/Archived
- **Settings Items**: Grouped by category with icons

### OpenWork Status
- ✅ Settings page exists with grouped sidebar
- ⚠️ Missing: specific settings items (智能体设置, 记忆, etc.)
- ⚠️ Different: OpenWork has different grouping

### Replication Plan
1. Align settings groups with WorkBuddy structure
2. Add missing settings items

---

## Page 17: 设置/常规 (General Settings)

### Screenshot
`screenshot-20260826-235122.png`

### Layout
- Left sidebar: Settings navigation with search
- Right content: "常规" settings panels
- Panels: 权限 (默认权限/完整访问权限), 常规 (默认文件打开位置/语言/菜单栏显示/...)
- Controls: Toggles, sliders, dropdowns, buttons

### Key Components
- **Permission Controls**: Default/Full access with descriptions
- **Language Dropdown**: "自动检测"
- **Font Size Slider**: 小/默认/大
- **Theme Toggle**: 浅色/深色

### OpenWork Status
- ✅ General settings exist
- ⚠️ Missing: theme toggle (浅色/深色), font size slider
- ⚠️ Different: OpenWork has different setting items

### Replication Plan
1. Add theme toggle (浅色/深色)
2. Add font size slider
3. Align permission controls with WorkBuddy

---

## Summary of Critical Gaps

| Priority | Gap | Effort |
|----------|-----|--------|
| P0 | Automations route guard (FIXED) | 5 min |
| P0 | Screen flash on tab switch (FIXED with key prop) | 10 min |
| P1 | Expert detail modal with "召唤专家" | Medium |
| P1 | Right project config panel | Medium |
| P1 | Mobile view toggle | Low |
| P2 | Template preview screenshots | Medium |
| P2 | Storage usage bar | Low |
| P2 | "精选场景" section on experts | Low |
| P3 | Promotional cards | Low |
| P3 | "资料库的100种用法" carousel | Medium |

## Files Modified

1. `apps/app/src/app/index.css` — Updated color scheme to WorkBuddy green
2. `apps/app/src/react-app/domains/session/sidebar/app-sidebar.tsx` — Added version number
3. `apps/app/src/react-app/domains/session/sidebar/sidebar-nav.ts` — Added "More" nav item
4. `apps/app/src/i18n/locales/en.ts` — Added sidebar.more, composer.auto_mode keys
5. `apps/app/src/i18n/locales/zh.ts` — Added Chinese translations
6. `apps/app/src/react-app/domains/session/surface/composer/composer.tsx` — Added Auto mode toggle and voice input
7. `apps/app/src/react-app/shell/session-route.tsx` — Fixed automations route guard, added key prop for flash
8. `apps/app/src/react-app/domains/session/chat/session-page.tsx` — Added mobile view toggle

## Test Results

- i18n: 6/6 pass
- Eval spec: 23 pass, 7 skip (pre-existing TLS test failure unrelated)
- Typecheck: No errors