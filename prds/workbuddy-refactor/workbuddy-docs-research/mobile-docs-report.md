# WorkBuddy 移动端文档 — 完整研究报告

> 说明：用户提供的 URL `/docs/workbuddyapp/<Page>` 均为壳页面（返回通用 VitePress 着陆页，无正文、无图片）。
> 通过解析 VitePress sidebar 侧边栏 JS，真实移动端功能页面位于 `/docs/workbuddyapp/features/<Page>`。
> 以下从 11 个 feature 页面抓取内容，下载图片，并提取正文与 alt 信息。

---

## Homepage  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Homepage`
- 图片数: 5

### TEXT 摘要
主页与导航 ​ 登录后进入主页，App 采用 底部 Tab 导航 结构，方便单手操作。 一、整体布局 ​ App 主页从上到下分为以下区域： 区域 位置图片 说明 顶部导航 左侧菜单 (≡) 打开侧边栏 环境切换 在 「云端工作」 和 「连接电脑」 之间切换任务执行环境 欢迎区域 显示 WorkBuddy 吉祥物和 slogan 快捷入口 常用场景标签，点击「更多」能查看更多常用场景 输入栏 消息输入框 + 附件按钮 + 语音按钮 + 发送按钮 二、快捷入口 ​ 输入框上方提供常用场景的快捷标签，横向滑动可查看全部： 快捷标签 说明 幻灯片 快速发起 PPT/演示文稿生成任务 视频生成 快速发起视频制作任务 深度研究 发起行业调研、深度分析类任务 文档处理 发起文档整理、生成、转换等任务 ... 横向滑动查看更多场景 点击任意标签，输入框中会自动填入对应场景的引导提示，直接发送即可开始。 三、环境切换：云端工作 VS 连接电脑 ​ 模式 解决什么问题 典型场景 云端工作 彻底摆脱电脑依赖，云端沙箱开即用 通勤、差旅、周末，没带电脑的任何时刻 连接电脑 远程操控桌面端 WorkBuddy，人走了电脑还能干活 已经离开工位，但需要电脑上的 WorkBuddy 执行任务 在顶部点击模式标签，即可在云端工作和连接电脑之间切换。

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 一、整体布局 ​
- H2: 二、快捷入口 ​
- H2: 三、环境切换：云端工作 VS 连接电脑 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Homepage-1.png` (398224 bytes)
  - alt: ``
  - src: `/docs/static/homepage-1.BfGhbgn-.png`
  - 上下文: 设置 快速导航 主页与导航 ​ 登录后进入主页，App 采用 底部 Tab 导航 结构，方便单手操作。 一、整体布局 ​ App 主页从上到下分为以下区域： 区域 位置图片 说明 顶部导航 左侧菜单 (≡) 打开侧边栏 环境切换
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Homepage-2.png` (398045 bytes)
  - alt: ``
  - src: `/docs/static/homepage-2.DV1V42-H.png`
  - 上下文: 左侧菜单 (≡) 打开侧边栏 环境切换 在 「云端工作」 和 「连接电脑」 之间切换任务执行环境 欢迎区域
- [3] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Homepage-3.png` (401308 bytes)
  - alt: ``
  - src: `/docs/static/homepage-3.DQJx8yTB.png`
  - 上下文: 在 「云端工作」 和 「连接电脑」 之间切换任务执行环境 欢迎区域 显示 WorkBuddy 吉祥物和 slogan 快捷入口
- [4] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Homepage-4.png` (397457 bytes)
  - alt: ``
  - src: `/docs/static/homepage-4.ClCTlCww.png`
  - 上下文: 显示 WorkBuddy 吉祥物和 slogan 快捷入口 常用场景标签，点击「更多」能查看更多常用场景 输入栏
- [5] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Homepage-5.png` (398878 bytes)
  - alt: ``
  - src: `/docs/static/homepage-5.DXxYhyY5.png`
  - 上下文: 常用场景标签，点击「更多」能查看更多常用场景 输入栏 消息输入框 + 附件按钮 + 语音按钮 + 发送按钮 二、快捷入口 ​ 输入框上方提供常用场景的快捷标签，横向滑动可查看全部： 快捷标签 说明 幻灯片 快速发起 PPT/演示文稿生成任务 视频生成 快速发起视频制作任务 深度研究 发起行业调研、深度分析类任务 文档处理 发起文档整

## Sidebar  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Sidebar`
- 图片数: 2

### TEXT 摘要
侧边栏 ​ 在 WorkBuddy 移动端（App）中，侧边栏提供了快速访问主要功能的入口。 概览 ​ 进入 App 主页，点击左上角菜单（≡）展开侧边栏： 侧边栏结构 ​ 侧边栏从上到下包含以下功能模块： 模式选择 ​ 在侧边栏顶部显示当前执行环境，可快速切换： ☁️ 云端工作 （默认）：使用云端沙箱执行任务，无需依赖个人电脑 🖥 连接电脑 ：远程操控电脑桌面端 WorkBuddy 执行任务 点击模式标签即可切换。使用连接电脑时，请确保电脑端 WorkBuddy 处于运行状态且使用同一微信账号登录。 新建任务 ​ 点击「+ 新建任务」可直接跳转到对话页面，开始全新的空白对话。 自动化 ​ 配置和管理自动化任务。点击进入自动化列表页面，可查看、编辑、启用或暂停已创建的自动化任务。 专家 ​ 按行业分类浏览专家，快速找到合适人选处理专业领域任务。 浏览不同行业的专家 点击专家查看详细介绍 任务历史 ​ 点击「任务」查看所有历史任务列表： 按时间倒序排列，最近的任务在最上方 当前进行中的任务会有高亮标识（浅绿色底色） 点击任意历史任务可切换到该任务的对话页面继续处理 点击编辑按钮可以删除历史任务 用户信息 ​ 侧边栏底部显示当前登录账户信息： 微信头像 微信昵称 点击右侧 ⚙ 齿轮图标 进入设置

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 概览 ​
- H2: 侧边栏结构 ​
- H3: 模式选择 ​
- H3: 新建任务 ​
- H3: 自动化 ​
- H3: 专家 ​
- H3: 任务历史 ​
- H3: 用户信息 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Sidebar-1.png` (375917 bytes)
  - alt: ``
  - src: `/docs/static/sidebar-1.CIU5h9q-.png`
  - 上下文: 设置 快速导航 侧边栏 ​ 在 WorkBuddy 移动端（App）中，侧边栏提供了快速访问主要功能的入口。 概览 ​ 进入 App 主页，点击左上角菜单（≡）展开侧边栏： 侧边栏结构 ​ 侧边栏从上到下包含以下功能模块： 模式选择 ​ 在侧边栏顶部显示当前执行环境，可快速切换： ☁️ 云端工作 （默认）：使用云端沙箱执行任务，无需依赖个人电脑 🖥 连接电脑 ：远程操控电脑桌面端 WorkBudd
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Sidebar-2.png` (385684 bytes)
  - alt: ``
  - src: `/docs/static/sidebar-2.BNpZdRES.png`
  - 上下文: 侧边栏从上到下包含以下功能模块： 模式选择 ​ 在侧边栏顶部显示当前执行环境，可快速切换： ☁️ 云端工作 （默认）：使用云端沙箱执行任务，无需依赖个人电脑 🖥 连接电脑 ：远程操控电脑桌面端 WorkBuddy 执行任务 点击模式标签即可切换。使用连接电脑时，请确保电脑端 WorkBuddy 处于运行状态且使用同一微信账号登录。 新建任务 ​ 点击「+ 新建任务」可直接跳转到对话页面，开始全新的

## Task-Execution  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Task-Execution`
- 图片数: 7

### TEXT 摘要
任务执行与对话 ​ 一、入口 ​ 任务发送后，WorkBuddy 自动拆解并逐步执行，执行过程实时展示在对话区域中。 二、步骤拆解 ​ 任务被自动拆分为多个阶段，每个阶段以卡片形式展示： 「拆解为 N 个步骤」 ：显示该阶段包含的子步骤数量 「已完成」 （绿色标签）：该步骤已执行完毕 点击卡片右侧 &gt; 可展开查看详细过程 三、继续追问 ​ 任务完成后可在同一对话中继续追问，例如： &quot;把表格按销售额排序&quot; &quot;再加一个饼图&quot; &quot;导出成 PDF&quot; WorkBuddy 会保持上下文，无需重复描述背景。 四、中断执行 ​ 任务进行中时，输入栏会显示停止按钮（■），点击可随时中断当前执行。 中断后仍可继续补充说明或调整需求。 五、重新生成 ​ 如果对执行结果不满意，可以： 长按某条 AI 回复，弹出操作菜单 点击 「重新生成」 WorkBuddy 会基于相同输入重新执行 下一步 ​ 任务完成后，了解如何 查看和分享产物 。

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 一、入口 ​
- H2: 二、步骤拆解 ​
- H2: 三、继续追问 ​
- H2: 四、中断执行 ​
- H2: 五、重新生成 ​
- H2: 下一步 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Task-Execution-1.png` (366684 bytes)
  - alt: ``
  - src: `/docs/static/task-1.CtqHb8-X.png`
  - 上下文: 微信文件打开 设置 快速导航 任务执行与对话 ​ 一、入口 ​ 任务发送后，WorkBuddy 自动拆解并逐步执行，执行过程实时展示在对话区域中。 二、步骤拆解 ​ 任务被自动拆分为多个阶段，每个阶段以卡片形式展示： 「拆解为 N 个步骤」 ：显示该阶段包含的子步骤数量 「已完成」 （绿色标签）：该步骤已执行完毕 点击卡片右侧 &gt; 可展开查看详细过程
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Task-Execution-2.png` (318185 bytes)
  - alt: ``
  - src: `/docs/static/task-2.CUCfXiMk.png`
  - 上下文: 二、步骤拆解 ​ 任务被自动拆分为多个阶段，每个阶段以卡片形式展示： 「拆解为 N 个步骤」 ：显示该阶段包含的子步骤数量 「已完成」 （绿色标签）：该步骤已执行完毕 点击卡片右侧 &gt; 可展开查看详细过程
- [3] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Task-Execution-3.png` (405543 bytes)
  - alt: ``
  - src: `/docs/static/task-3.BKtXymed.png`
  - 上下文: 
- [4] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Task-Execution-4.png` (489185 bytes)
  - alt: ``
  - src: `/docs/static/task-4.iiHQf-iF.png`
  - 上下文: 三、继续追问 ​ 任务完成后可在同一对话中继续追问，例如： &quot;把表格按销售额排序&quot; &quot;再加一个饼图&quot; &quot;导出成 PDF&quot; WorkBuddy 会保持上下文，无需重复描述背景。 四、中断执行 ​ 任务进行中时，输入栏会显示停止按钮（■），点击可随时中断当前执行。 中断
- [5] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Task-Execution-5.png` (379590 bytes)
  - alt: ``
  - src: `/docs/static/task-5.BFiPXsS5.png`
  - 上下文: 成后可在同一对话中继续追问，例如： &quot;把表格按销售额排序&quot; &quot;再加一个饼图&quot; &quot;导出成 PDF&quot; WorkBuddy 会保持上下文，无需重复描述背景。 四、中断执行 ​ 任务进行中时，输入栏会显示停止按钮（■），点击可随时中断当前执行。 中断后仍可继续补充说明或调整需求。
- [6] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Task-Execution-6.png` (319362 bytes)
  - alt: ``
  - src: `/docs/static/task-6.Ito9X07E.png`
  - 上下文: 
- [7] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Task-Execution-7.png` (320244 bytes)
  - alt: ``
  - src: `/docs/static/task-7.Cs4qyo0E.png`
  - 上下文: 五、重新生成 ​ 如果对执行结果不满意，可以： 长按某条 AI 回复，弹出操作菜单 点击 「重新生成」 WorkBuddy 会基于相同输入重新执行 下一步 ​ 任务完成后，了解如何 查看和分享产物 。 最后更新: Pager 上一页 添加附件与更多功能 下一页 产物查

## Share  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Share`
- 图片数: 5

### TEXT 摘要
产物查看与分享 ​ 任务执行完成后，产生的文件（产物）可以预览、分享和保存到本地。 一、查看产物 ​ 任务执行完成后，产物文件会直接展示在对话中，可以点击 「查看文件」 查看： 提示 产物文件支持预览 PDF、DOCX、Markdown 等格式。 二、分享产物 ​ 点击产物文件右上方的 分享 按钮： 弹出分享确认弹窗 点击 确认分享 后生成分享链接 可将链接分享到微信、QQ 等其他系统显示的渠道 三、导出产物文件 ​ App 端支持将产物直接保存到手机本地： 点击产物文件，打开预览页面 点击预览页面右上角的 **「分享」**按钮 可以将产物导出为PDF、DOCX、Markdown或导出到腾讯文档。 四、重新生成产物 ​ 如果对产物不满意，可以在对话中直接对任务提出修改要求，WorkBuddy 会保持上下文并重新生成。

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 一、查看产物 ​
- H2: 二、分享产物 ​
- H2: 三、导出产物文件 ​
- H2: 四、重新生成产物 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Share-1.png` (525011 bytes)
  - alt: ``
  - src: `/docs/static/share-1.aMgZ6mTl.png`
  - 上下文: 设置 快速导航 产物查看与分享 ​ 任务执行完成后，产生的文件（产物）可以预览、分享和保存到本地。 一、查看产物 ​ 任务执行完成后，产物文件会直接展示在对话中，可以点击 「查看文件」 查看：
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Share-2.png` (302043 bytes)
  - alt: ``
  - src: `/docs/static/share-2.BAz5vuLm.png`
  - 上下文: 提示 产物文件支持预览 PDF、DOCX、Markdown 等格式。 二、分享产物 ​ 点击产物文件右上方的 分享 按钮： 弹出分享确认弹窗
- [3] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Share-3.png` (300389 bytes)
  - alt: ``
  - src: `/docs/static/share-3.I6ptWFze.png`
  - 上下文: 提示 产物文件支持预览 PDF、DOCX、Markdown 等格式。 二、分享产物 ​ 点击产物文件右上方的 分享 按钮： 弹出分享确认弹窗 点击 确认分享 后生成分享链接
- [4] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Share-4.png` (336258 bytes)
  - alt: ``
  - src: `/docs/static/share-4.BoA3l7h6.png`
  - 上下文: 点击 确认分享 后生成分享链接 可将链接分享到微信、QQ 等其他系统显示的渠道 三、导出产物文件 ​ App 端支持将产物直接保存到手机本地： 点击产物文件，打开预览页面 点击预览页面右上角的 **「分享」**按钮 可以将产物导出为PDF、DOCX、Markdown或导出到腾讯文档。
- [5] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Share-5.png` (810880 bytes)
  - alt: ``
  - src: `/docs/static/share-5.25IsRCNn.png`
  - 上下文: 可将链接分享到微信、QQ 等其他系统显示的渠道 三、导出产物文件 ​ App 端支持将产物直接保存到手机本地： 点击产物文件，打开预览页面 点击预览页面右上角的 **「分享」**按钮 可以将产物导出为PDF、DOCX、Markdown或导出到腾讯文档。 四、重新生成产物 ​ 如果对产物不满意，可以在对话中直接对任务提出修改要求，WorkBuddy 会保持上下文并重新生成。 最后更新: Pager 

## Create-Task  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Create-Task`
- 图片数: 5

### TEXT 摘要
发起任务 ​ 在 WorkBuddy 移动端 App 中，您可以通过多种方式发起任务。 一、直接输入 ​ 在 底部输入框 中用 自然语言描述需求 ， 点击发送按钮 即可。 二、使用快捷入口 ​ 点击 输入框上方 的 场景标签 （如「深度研究」「文档处理」），输入框会自动填入引导提示，直接发送即可进入对应场景。 三、从侧边栏新建 ​ 打开侧边栏 → 点击 + 新建任务 ，进入新的空白对话 四、通过系统分享入口发起（App 独有） ​ WorkBuddy 移动端 App 支持系统级分享入口： 在其他 App（如浏览器、相册、文件管理器）中选中内容 点击 分享 按钮 在分享菜单中选择 WorkBuddy 内容将自动带入输入框，直接发送即可 支持的分享内容类型：文字、链接、图片、文件 五、语音输入 ​ 点击输入栏右侧的 麦克风按钮 ，开始语音输入： 按住麦克风按钮开始录音 松开按钮自动发送语音内容 WorkBuddy 会自动将语音转为文字，发起任务 首次使用需在系统设置中授权麦克风权限。 下一步 ​ 了解如何 选择模型 以获得最佳效果 了解如何 添加附件与技能

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 一、直接输入 ​
- H2: 二、使用快捷入口 ​
- H2: 三、从侧边栏新建 ​
- H2: 四、通过系统分享入口发起（App 独有） ​
- H2: 五、语音输入 ​
- H2: 下一步 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Create-Task-1.png` (388012 bytes)
  - alt: ``
  - src: `/docs/static/create-1.OowvJft0.png`
  - 上下文: 设置 快速导航 发起任务 ​ 在 WorkBuddy 移动端 App 中，您可以通过多种方式发起任务。 一、直接输入 ​ 在 底部输入框 中用 自然语言描述需求 ， 点击发送按钮 即可。 二、使用快捷入口 ​ 点击 输入框上方 的 场景标签 （如「深度研究」「文档处理」），输入框会自动填入引导提示，直接发送即可进入对应场景。
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Create-Task-2.png` (351960 bytes)
  - alt: ``
  - src: `/docs/static/create-2.Dn0zxBc7.png`
  - 上下文: 二、使用快捷入口 ​ 点击 输入框上方 的 场景标签 （如「深度研究」「文档处理」），输入框会自动填入引导提示，直接发送即可进入对应场景。
- [3] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Create-Task-3.png` (331319 bytes)
  - alt: ``
  - src: `/docs/static/create-3.CbdjY4T9.png`
  - 上下文: 三、从侧边栏新建 ​ 打开侧边栏 → 点击 + 新建任务 ，进入新的空白对话
- [4] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Create-Task-4.png` (397114 bytes)
  - alt: ``
  - src: `/docs/static/create-4.C6Ilu2l2.png`
  - 上下文: 三、从侧边栏新建 ​ 打开侧边栏 → 点击 + 新建任务 ，进入新的空白对话
- [5] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Create-Task-5.png` (322979 bytes)
  - alt: ``
  - src: `/docs/static/create-5.fgPu03TU.png`
  - 上下文: 四、通过系统分享入口发起（App 独有） ​ WorkBuddy 移动端 App 支持系统级分享入口： 在其他 App（如浏览器、相册、文件管理器）中选中内容 点击 分享 按钮 在分享菜单中选择 WorkBuddy 内容将自动带入输入框，直接发送即可 支持的分享内容类型：文字、链接、图片、文件 五、语音输入 ​ 点击

## Attachments-and-Skills  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Attachments-and-Skills`
- 图片数: 13

### TEXT 摘要
添加附件与更多功能 ​ 概览 ​ 点击输入栏 左侧的 + 按钮 ，展开工具面板： 工具面板功能一览： 入口 功能 适用场景 拍照 调用手机摄像头实时拍照 拍摄纸质文档、白板笔记、发票、名片等 照片/视频 从手机相册选择已有图片和视频 处理已保存的截图、照片和视频 手机文件 从本机文件管理选择文件 上传 Excel、Word、PDF、TXT 等文件 腾讯文档 从已连接的腾讯文档中选择文件 支持读取腾讯文档中的所有文件 定时任务 设置定时或周期性自动任务 每日资讯推送、定期报告生成等 专家中心 浏览和发起专家对话 专业领域任务的精细化处理 拍照 ​ 点击 拍照 后，会请求相机权限（首次使用时），授权后进入拍照界面。 每次拍摄 1 张照片 ，拍摄完成后自动返回对话界面 照片会显示在输入框上方，点击 × 可移除 如需拍摄多张，需再次点击 + → 拍照 重复操作 ⚠️ 注意 ：使用拍照或照片功能时，建议选择带「视觉」标签的模型（如 DeepSeek-V4-Flash、Kimi-K2.5 等），否则 AI 无法理解图片内容。 照片/视频 ​ 点击 照片/视频 后，会请求相册访问权限（首次使用时），授权后进入相册选择界面。 支持一次选择多张图片（最多 5 张） 选中的图片显示在输入框上方，可逐张预览和删除 支持常见图片格式：JPG、PNG 等 拍照 vs 照片 对比： 对比维度 拍照 照片 来源 实时拍摄 手机相册 数量 每次 1 张 支持多选（最多 5 张） 适用场景 临时拍 1 张快速识别 已拍好多张，批量上传 推荐做法 ：需要多张图片时，先用手机自带相机拍完，再通过「照片」一次性选择上传。 手机文件 ​ 点击 手机文件 后，会调用系统文件选择器： 浏览手机上的文件夹和文件 选择目标文件，点击确认 文件将添加到输入框上方，点击发送即可 支持的文件类型： 类型 格式 表格 .xlsx、.xls、.csv 文档 .docx、.doc、.txt PDF .pdf 图片 .jpg、.png、.gif 腾讯文档 ​ App 登录后自动连接相同账号的腾讯文档。未连接时，按以下流程操作： 点击 腾讯文档 勾选同意协议后，点击 同意 授权完成连接 选择目标文件，点击 添加 引用到当前对话 定时任务 ​ 通过工具面板可快速设置定时或周期性自动任务： 点击 定时任务 ，进入定时任务设置页面 描述需要自动执行的任务内容 设置执行频率（每天、每周、每月等）和执行时间 保存后，WorkBuddy 将在设定时间自动执行 例如：&quot;每天早上 9 点推送昨日 AI 行业新闻摘要&quot;、&quot;每周五下午 5 点生成本周工作总结&quot; 专家 ​ 点击 专家 可浏览不同专业领域的专家，发起针对性对话： 按行业分类浏览专家 查看专家擅长领域和介绍 一键发起专家对话 详见 侧边栏 - 专家

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 概览 ​
- H2: 拍照 ​
- H2: 照片/视频 ​
- H2: 手机文件 ​
- H2: 腾讯文档 ​
- H2: 定时任务 ​
- H2: 专家 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-1.png` (397844 bytes)
  - alt: ``
  - src: `/docs/static/skill-1.B-7QC7Qo.png`
  - 上下文: 多端协同（连接电脑） 微信文件打开 设置 快速导航 添加附件与更多功能 ​ 概览 ​ 点击输入栏 左侧的 + 按钮 ，展开工具面板：
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-2.png` (560946 bytes)
  - alt: ``
  - src: `/docs/static/skill-2.B0ByURll.png`
  - 上下文: 工具面板功能一览： 入口 功能 适用场景 拍照 调用手机摄像头实时拍照 拍摄纸质文档、白板笔记、发票、名片等 照片/视频 从手机相册选择已有图片和视频 处理已保存的截图、照片和视频 手机文件 从本机文件管理选择文件 上传 Excel、Word、PDF、TXT 等文件 腾讯文档 从已连
- [3] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-3.png` (218627 bytes)
  - alt: ``
  - src: `/docs/static/skill-3.B8FBT8hd.png`
  - 上下文: 每日资讯推送、定期报告生成等 专家中心 浏览和发起专家对话 专业领域任务的精细化处理 拍照 ​ 点击 拍照 后，会请求相机权限（首次使用时），授权后进入拍照界面。 每次拍摄 1 张照片 ，拍摄完成后自动返回对话界面 照片会显示在输入框上方，点击 × 可移除 如需拍摄多张，需再次点击 + → 拍照 重复操作
- [4] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-4.png` (416235 bytes)
  - alt: ``
  - src: `/docs/static/skill-4.BmGAMlUA.png`
  - 上下文: 
- [5] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-5.png` (421513 bytes)
  - alt: ``
  - src: `/docs/static/skill-5.ZYnfZiDe.png`
  - 上下文: ⚠️ 注意 ：使用拍照或照片功能时，建议选择带「视觉」标签的模型（如 DeepSeek-V4-Flash、Kimi-K2.5 等），否则 AI 无法理解图片内容。 照片/视频 ​ 点击 照片/视频 后，会请求相册访问权限（首次使用时），授权后进入相册选择界面。 支持一次选择多张图片（最多 5 张） 选中的图片显示在输入框上方，可
- [6] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-6.png` (370871 bytes)
  - alt: ``
  - src: `/docs/static/skill-6.Bgcs97AT.png`
  - 上下文: 」标签的模型（如 DeepSeek-V4-Flash、Kimi-K2.5 等），否则 AI 无法理解图片内容。 照片/视频 ​ 点击 照片/视频 后，会请求相册访问权限（首次使用时），授权后进入相册选择界面。 支持一次选择多张图片（最多 5 张） 选中的图片显示在输入框上方，可逐张预览和删除 支持常见图片格式：JPG、PNG 等
- [7] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-7.png` (376525 bytes)
  - alt: ``
  - src: `/docs/static/skill-7.DKmWlq_U.png`
  - 上下文: 
- [8] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-8.png` (280556 bytes)
  - alt: ``
  - src: `/docs/static/skill-8.EviPAcd1.png`
  - 上下文: 拍照 vs 照片 对比： 对比维度 拍照 照片 来源 实时拍摄 手机相册 数量 每次 1 张 支持多选（最多 5 张） 适用场景 临时拍 1 张快速识别 已拍好多张，批量上传 推荐做法 ：需要多张图片时，先用手机自带相机拍完，再通过「照片」一次性选择上传。 手机文件 ​ 点
- [9] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-9.png` (409969 bytes)
  - alt: ``
  - src: `/docs/static/skill-9.BWs78Yfd.png`
  - 上下文: 即可 支持的文件类型： 类型 格式 表格 .xlsx、.xls、.csv 文档 .docx、.doc、.txt PDF .pdf 图片 .jpg、.png、.gif 腾讯文档 ​ App 登录后自动连接相同账号的腾讯文档。未连接时，按以下流程操作： 点击 腾讯文档 勾选同意协议后，点击 同意 授权完成连接
- [10] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-10.png` (370207 bytes)
  - alt: ``
  - src: `/docs/static/skill-10.Bq3UdXb5.png`
  - 上下文: 勾选同意协议后，点击 同意 授权完成连接 选择目标文件，点击 添加 引用到当前对话
- [11] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-11.png` (534549 bytes)
  - alt: ``
  - src: `/docs/static/skill-11.U6ag5wh9.png`
  - 上下文: 选择目标文件，点击 添加 引用到当前对话
- [12] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-12.png` (410557 bytes)
  - alt: ``
  - src: `/docs/static/skill-12.D6nMGsNO.png`
  - 上下文: 定时任务 ​ 通过工具面板可快速设置定时或周期性自动任务： 点击 定时任务 ，进入定时任务设置页面 描述需要自动执行的任务内容 设置执行频率（每天、每周、每月等）和执行时间 保存后，WorkBuddy 将在设定时间自动执行 例如：&quot;每天早上 9 点推送昨日 AI 行业新闻摘要&quot;、&quot;每周五下
- [13] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Attachments-and-Skills-13.png` (372777 bytes)
  - alt: ``
  - src: `/docs/static/skill-13.DaNSxZFO.png`
  - 上下文: 快速设置定时或周期性自动任务： 点击 定时任务 ，进入定时任务设置页面 描述需要自动执行的任务内容 设置执行频率（每天、每周、每月等）和执行时间 保存后，WorkBuddy 将在设定时间自动执行 例如：&quot;每天早上 9 点推送昨日 AI 行业新闻摘要&quot;、&quot;每周五下午 5 点生成本周工作总结&quot; 专家 ​ 点击 专家 可浏览不同专业领域的专家，发起针对性对话： 按

## Auto  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Auto`
- 图片数: 4

### TEXT 摘要
自动化 ​ 自动化让你可以为任务设定执行时间，WorkBuddy App 按时自动执行，无需手动操作。 提示 以下内容是在 云端工作 下的配置指引。 连接电脑 下的自动化用于接收电脑端自动化任务执行结果。 添加定时任务 ​ 方式一：表单创建 ​ 进入自动化页面，点击 + 图标添加定时任务 填写以下信息： 字段 说明 标题 给定时任务起一个名字 提示词 描述需要自动执行的任务内容 执行频率 每天、每周、每月等 执行时间 具体的执行时刻 填写完成后点击 创建 ，定时任务将自动添加到列表中 方式二：对话创建 ​ 在自动化页面点击 对话创建 ，用自然语言描述定时任务需求，WorkBuddy 将自动解析并创建。例如： &quot;每天早上 9 点推送昨日 AI 行业新闻摘要&quot; &quot;每周五下午 5 点生成本周工作总结&quot; 定时任务管理 ​ 创建完成后，定时任务显示在列表中。点击任务右上角的 ... 菜单，可以进行以下操作： 操作 说明 编辑 修改任务标题、提示词、频率或时间 测试运行 立即执行一次任务，验证是否按预期运行 暂停/恢复 暂停定时执行，或恢复已暂停的任务 删除 删除该定时任务 点击任务卡片可跳转至 任务详情 ，查看历史执行记录和测试结果。 查看执行结果 ​ 自动化任务执行后，App 会通过 通知 告知结果（需开启通知权限）。也可以在自动化页面点击任务卡片查看每次执行的历史记录。

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 添加定时任务 ​
- H3: 方式一：表单创建 ​
- H3: 方式二：对话创建 ​
- H2: 定时任务管理 ​
- H2: 查看执行结果 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Auto-1.png` (234240 bytes)
  - alt: ``
  - src: `/docs/static/auto-1.CxTEJoQC.png`
  - 上下文: 自动化 ​ 自动化让你可以为任务设定执行时间，WorkBuddy App 按时自动执行，无需手动操作。 提示 以下内容是在 云端工作 下的配置指引。 连接电脑 下的自动化用于接收电脑端自动化任务执行结果。 添加定时任务 ​ 方式一：表单创建 ​ 进入自动化页面，点击 + 图标添加定时任务 填写以下信息： 字段 说明 标题 给定时任务起一个名字 提示词 描述需要自动执行的任务内容 执行频率 每天、每
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Auto-2.png` (356947 bytes)
  - alt: ``
  - src: `/docs/static/auto-2.B2SMUr_q.png`
  - 上下文: 填写以下信息： 字段 说明 标题 给定时任务起一个名字 提示词 描述需要自动执行的任务内容 执行频率 每天、每周、每月等 执行时间 具体的执行时刻 填写完成后点击 创建 ，定时任务将自动添加到列表中 方式二：对话创建 ​ 在自动化页面点击 对话创建 ，用自然语言描述定时任务需求，WorkBuddy 将自动解析并创建。例如： &quot;每天早上 9 点推送昨日 AI 行业新闻摘要&quot; &q
- [3] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Auto-3.png` (537947 bytes)
  - alt: ``
  - src: `/docs/static/auto-3.DYoF8tRQ.png`
  - 上下文: 填写完成后点击 创建 ，定时任务将自动添加到列表中 方式二：对话创建 ​ 在自动化页面点击 对话创建 ，用自然语言描述定时任务需求，WorkBuddy 将自动解析并创建。例如： &quot;每天早上 9 点推送昨日 AI 行业新闻摘要&quot; &quot;每周五下午 5 点生成本周工作总结&quot; 定时任务管理 ​ 创建完成后，定时任务显示在列表中。点击任务右上角的 ... 菜单，可以进行
- [4] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Auto-4.png` (237573 bytes)
  - alt: ``
  - src: `/docs/static/auto-4.DasBkjBA.png`
  - 上下文: 定时任务管理 ​ 创建完成后，定时任务显示在列表中。点击任务右上角的 ... 菜单，可以进行以下操作： 操作 说明 编辑 修改任务标题、提示词、频率或时间 测试运行 立即执行一次任务，验证是否按预期运行 暂停/恢复 暂停定时执行，或恢复已暂停的任务 删除 删除该定时任务 点击任务卡片可跳转至 任务详情 ，查看历史执行记录和测试结果。 查看执行结果 ​ 自动化任务执行后，App 会通过 通知 告知结

## Expert  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Expert`
- 图片数: 4

### TEXT 摘要
专家 ​ 在专家中心为 WorkBuddy 配置专业角色，能够在特定领域中以更明确的方法和视角完成任务。 专家 ​ 每位专家都拥有独立的人设、方法论和工具链，针对所在领域的典型工作场景深度打磨—— 召唤谁，就像真的请到了那个岗位的资深从业者 。 支持 搜索 专家名称、职称、简介 支持按 行业分类 浏览专家 支持 分享 喜欢的专家给好友 专家团 ​ 专家团是一个有团长、有分工、有协作的多 Agent 团队。您只需要描述任务，团长会自动拆解、分配给最合适的团员并行执行，最后整合交付—— 像一个真正的项目组在帮您干活 。 操作流程 ​ 召唤专家/专家团 ​ 浏览或搜索找到需要的专家 / 专家团 点击进入 专家详情 页，查看专家擅长领域和简介 点击 开始对话 ，专家将添加到对话中 描述任务 ​ 使用专家 ：将任务告诉 WorkBuddy，专家会按照该角色的专业视角和方法完成任务。 使用专家团 ：用自然语言描述任务后，专家团团长自动拆解、分配、执行并返回完整结果。 Skill VS 专家 VS 专家团 ​ 维度 Skill 专家 专家团 组成关系 工具能力：让 AI 能做某件事 AI 顾问：懂某个领域的 AI 角色 AI 协作团队：自动拆解、并行执行、完整交付 怎么选 需要一个具体工具能力 有一个明确的单点问题 任务复杂，需要多角色配合 总结 ： Skill 是能力， 专家 是能力 + 经验， 专家团 是多位专家 + 协作流程。

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 专家 ​
- H2: 专家团 ​
- H2: 操作流程 ​
- H3: 召唤专家/专家团 ​
- H3: 描述任务 ​
- H2: Skill VS 专家 VS 专家团 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Expert-1.png` (702127 bytes)
  - alt: ``
  - src: `/docs/static/expert-1.DlEZ6LSY.png`
  - 上下文: 家 ​ 在专家中心为 WorkBuddy 配置专业角色，能够在特定领域中以更明确的方法和视角完成任务。 专家 ​ 每位专家都拥有独立的人设、方法论和工具链，针对所在领域的典型工作场景深度打磨—— 召唤谁，就像真的请到了那个岗位的资深从业者 。 支持 搜索 专家名称、职称、简介 支持按 行业分类 浏览专家 支持 分享 喜欢的专家给好友 专家团 ​ 专家团是一个有团长、有分工、有协作的多 Agent 
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Expert-2.png` (836379 bytes)
  - alt: ``
  - src: `/docs/static/expert-2.6k-k_-2K.png`
  - 上下文: 专家团 ​ 专家团是一个有团长、有分工、有协作的多 Agent 团队。您只需要描述任务，团长会自动拆解、分配给最合适的团员并行执行，最后整合交付—— 像一个真正的项目组在帮您干活 。 操作流程 ​ 召唤专家/专家团 ​ 浏览或搜索找到需要的专家 / 专家团 点击进入 专家详情 页，查看专家擅长领域和简介 点击 开始对话 ，专家将添加到对话中
- [3] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Expert-3.png` (435045 bytes)
  - alt: ``
  - src: `/docs/static/expert-3.DgiZil9H.png`
  - 上下文: 操作流程 ​ 召唤专家/专家团 ​ 浏览或搜索找到需要的专家 / 专家团 点击进入 专家详情 页，查看专家擅长领域和简介 点击 开始对话 ，专家将添加到对话中 描述任务 ​ 使用专家 ：将任务告诉 WorkBuddy，专家会按照该角色的专业视角和方法完成任务。
- [4] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Expert-4.png` (484724 bytes)
  - alt: ``
  - src: `/docs/static/expert-4.DVdB0Ezo.png`
  - 上下文: 描述任务 ​ 使用专家 ：将任务告诉 WorkBuddy，专家会按照该角色的专业视角和方法完成任务。 使用专家团 ：用自然语言描述任务后，专家团团长自动拆解、分配、执行并返回完整结果。 Skill VS 专家 VS 专家团 ​ 维度 Skill 专家 专家团 组成关系 工具能力：让 AI 能做某件事 AI 顾问：懂某个领域的 AI 角色 AI 协作团队：自动拆解、并行执行、完整交付 怎么选 需要一

## Model  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Model`
- 图片数: 2

### TEXT 摘要
选择模型 ​ 一、入口 ​ 点击输入栏中的模型名称（如「Auto ▾」），弹出模型选择面板。 二、可用模型一览 ​ 模型 能力标签 推荐场景 Auto 推理 + 视觉 智能自动选择（默认） Hy3 推理 + 视觉 高性能推理与视觉理解 GLM-5.2 推理 + 视觉 1M 上下文，擅长长程任务 GLM-5.1 推理 多步骤复杂任务，深度推理 GLM-5v-Turbo 推理 + 视觉 原生多模态模型 MiniMax-M3 推理 + 视觉 原生多模态，擅长代码、智能体任务 MiniMax-m2.7 推理 + 视觉 能力均衡，适合日常使用，性价比高 Kimi-K3 推理 + 视觉 擅长处理复杂的长程自主任务，前端开发能力突出，同时在知识工作与科研推理上表现出色 Kimi-K2.7-Code 推理 + 视觉 多模态模型，面向编程场景优化 Kimi-K2.6 推理 + 视觉 多模态模型，适合日常任务 DeepSeek-V4-Flash 推理 + 视觉 快速响应，兼顾视觉理解 DeepSeek-V4-Pro 推理 + 视觉 高性能推理与视觉分析 三、能力标签 ​ 标签 含义 推理 支持逻辑推理、任务规划与多步骤执行 视觉 支持图片理解（拍照、截图场景请选择此类模型） 四、积分消耗 ​ 不同模型的积分消耗有所不同。在模型选择面板中，每个模型名称下方会标注相应的积分倍率（如 x0.80、x1.00 等），数字越低消耗越少。 省钱小技巧 ：日常简单任务选择性价比高的推理模型，需要图片理解时再切换到带「视觉」标签的模型。如果不确定选哪个，使用默认的 Auto 即可，系统会自动匹配最优模型。

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 一、入口 ​
- H2: 二、可用模型一览 ​
- H2: 三、能力标签 ​
- H2: 四、积分消耗 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Model-1.png` (399517 bytes)
  - alt: ``
  - src: `/docs/static/model-1.Ck4A_TNP.png`
  - 上下文: 多端协同（连接电脑） 微信文件打开 设置 快速导航 选择模型 ​ 一、入口 ​ 点击输入栏中的模型名称（如「Auto ▾」），弹出模型选择面板。
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Model-2.png` (360639 bytes)
  - alt: ``
  - src: `/docs/static/model-2.BaaTiMKw.png`
  - 上下文: 二、可用模型一览 ​ 模型 能力标签 推荐场景 Auto 推理 + 视觉 智能自动选择（默认） Hy3 推理 + 视觉 高性能推理与视觉理解 GLM-5.2 推理 + 视觉 1M 上下文，擅长长程任务 GLM-5.1 推理 多步骤复杂任务，深度推理 GLM-5v-Turbo

## Multidevice  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/Multidevice`
- 图片数: 9

### TEXT 摘要
多端协同（连接电脑） ​ 手机连接电脑后，任务执行不再因设备切换而中断。 概述 ​ WorkBuddy 多端协同让您的手机成为桌面端 Agent 的「远程控制台」。当您在工位上启动 WorkBuddy 执行任务后，开会、通勤、外出时，均可通过手机随时接管。 核心功能 ​ 一键建联 ：移动端切换连接电脑，授权桌面端同账号一次配对，常驻协同 远程续聊 ：移动端进入对话继续发送指令，指令将在桌面端 WorkBuddy 执行 远程停止 ：任务偏离预期或等待确认时，移动端一键终止任务 状态可视化 ：设备级 + 对话级双层状态标识，随时掌握 WorkBuddy 任务进度 前置条件 ​ 在开始使用多端协同之前，需要确保： 桌面端 ：已安装并登录 WorkBuddy 桌面客户端（macOS / Windows），在右下角打开「允许移动端连接」 移动端 ：已在移动端登录 WorkBuddy，且使用与桌面端 同一账号 网络 ：桌面端与移动端均处于联网状态 推荐设置 打开系统设置中的「锁屏远程」设置项： 开启后即使在锁屏状态下，电脑也不会进入休眠、屏幕也不会自动关闭，便于通过手机远程操控并保持自动化任务持续运行。 连接设备 ​ 首次建联 ​ 桌面端开启连接许可 在 WorkBuddy 端，将鼠标悬停在右下角的图标上，点击打开「允许移动端连接」开关。 移动端发起连接 打开 WorkBuddy 移动端，进入主页后在左侧边栏选择「连接电脑」。 建联完成后，设备关系将持久保留，无需每次重复配对。后续打开移动端即可直接查看已连接电脑的任务状态。 保持连接 ​ 桌面端可在 系统设置 - 锁屏远程 中开启选项，即使电脑锁屏，移动端仍可远程查看和控制 Agent 任务。建议开启此选项以确保离开工位后连接不中断。 核心用法 ​ 查看任务状态 ​ 建联成功后，移动端主界面展示两层状态信息： 设备级状态 ： 状态 图标 含义 在线 绿点 桌面端在线可正常交互 离线 红点 桌面端离线或网络不可达 对话级状态 ： 状态 含义 运行中 WorkBuddy 正在执行任务，可查看实时进展 等待输入 任务暂停等待您的确认或补充指令 已完成 任务正常结束，可查看完整执行记录 已停止 任务被手动停止，显示当前完成步数 失败 任务执行异常中断，可查看错误原因 远程继续任务 ​ 当桌面端 WorkBuddy 执行过程中需要补充指令时，在移动端进入对应对话，直接发送消息即可继续。 在任务列表或工作空间中找到目标对话 点击进入对话详情页 在输入框发送指令，如「继续」「把刚才的改动加上日志」 指令自动路由到桌面端继续执行 在任务中通过右上角的新建图标新建任务，可以使 新建的任务在当前工作空间下执行 。 也可以返回首页，在左下角为当前任务 新建或选择远程工作空间 ： 远程停止任务 ​ 当发现任务执行方向偏离预期，或无需继续等待时，可直接在移动端停止任务。 进入正在运行的对话，点击输入框 点击右侧的发送按钮（运行中变为停止按钮），桌面端 Agent 立即终止执行 对话状态更新为「本轮任务已停止，电脑端已同步终止运行」 已完成的步骤结果保留在对话中，不受影响。 最佳实践 ​ 开启锁屏远程 ：在桌面端设置中启用「锁屏远程」，确保电脑锁屏后手机仍可查看和控制 Agent 利用通勤时间 ：在工位上启动 WorkBuddy 执行长时间任务，通勤路上通过手机跟进、续聊或停止 善用停止功能 ：发现 WorkBuddy 偏离预期方向时，及时停止以节省 Token 注意事项与重点提示 ​ 信息收集与使用 ​ 收集项 类型 用途 WorkBuddy 账号信息 必要 识别多端设备归属同一用户，建立设备间关联 设备标识（桌面端/移动端） 必要 建立设备配对关系，区分不同电脑的任务列表 对话内容与任务记录 必要 在移动端展示桌面端 WorkBuddy 执行状态与对话历史 设备在线状态 非必要 展示绿点/红点标识，提升用户体验 权限边界 ​ 移动端只能查看和管理已授权连接电脑上的 WorkBuddy 任务 不会主动获取未授权电脑的任何信息 远程操作以您本人身份和授权范围执行，不超出桌面端已有权限范围 安全提示 ​ 移动端与桌面端的通信经过安全中继通道加密 设备关系一对一绑定，其他账号无法连接您的电脑 不再使用的设备可在桌面端或移动端随时断开连接 建议在公共设备上使用后及时退出 WorkBuddy 账号 积分消耗提醒 ​ 移动端查看任务状态和发送续聊指令本身不额外消耗积分；WorkBuddy 在桌面端实际执行任务时消耗积分，与直接在桌面端操作一致。 第三方共享 ​ 多端协同涉及 WorkBuddy 桌面端与移动端之间的数据同步，数据由 WorkBuddy 维护以供代您调用，不涉及与第三方服务的额外共享。 免责声明 ​ 远程停止任

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 概述 ​
- H2: 核心功能 ​
- H2: 前置条件 ​
- H2: 连接设备 ​
- H3: 首次建联 ​
- H3: 保持连接 ​
- H2: 核心用法 ​
- H3: 查看任务状态 ​
- H3: 远程继续任务 ​
- H3: 远程停止任务 ​
- H2: 最佳实践 ​
- H2: 注意事项与重点提示 ​
- H3: 信息收集与使用 ​
- H3: 权限边界 ​
- H3: 安全提示 ​
- H3: 积分消耗提醒 ​
- H3: 第三方共享 ​
- H3: 免责声明 ​
- H3: 使用建议 ​
- H2: 声明 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Multidevice-1.png` (6950 bytes)
  - alt: `桌面端开启允许连接`
  - src: `/docs/static/multidevice-1.j4TSwAHV.png`
  - 上下文: 移动端均处于联网状态 推荐设置 打开系统设置中的「锁屏远程」设置项： 开启后即使在锁屏状态下，电脑也不会进入休眠、屏幕也不会自动关闭，便于通过手机远程操控并保持自动化任务持续运行。 连接设备 ​ 首次建联 ​ 桌面端开启连接许可 在 WorkBuddy 端，将鼠标悬停在右下角的图标上，点击打开「允许移动端连接」开关。 移动端发起连接 打开 WorkBuddy 移动端，进入主页后在左侧边栏选择「连接
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Multidevice-2.png` (63398 bytes)
  - alt: `连接电脑入口`
  - src: `/docs/static/multidevice-2.RYtXeXSd.png`
  - 上下文: 移动端发起连接 打开 WorkBuddy 移动端，进入主页后在左侧边栏选择「连接电脑」。 建联完成后，设备关系将持久保留，无需每次重复配对。后续打开移动端即可直接查看已连接电脑的任务状态。 保持连接 ​ 桌面端可在 系统设置 - 锁屏远程 中开启选项，即使电脑锁屏，移动端仍可远程查看和控制 Agent 任务。建议开启此选项以确保离开工位后连接不中断。
- [3] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Multidevice-3.png` (31143 bytes)
  - alt: `锁屏远程开启`
  - src: `/docs/static/multidevice-3.s7xBZUc_.png`
  - 上下文: 建联完成后，设备关系将持久保留，无需每次重复配对。后续打开移动端即可直接查看已连接电脑的任务状态。 保持连接 ​ 桌面端可在 系统设置 - 锁屏远程 中开启选项，即使电脑锁屏，移动端仍可远程查看和控制 Agent 任务。建议开启此选项以确保离开工位后连接不中断。 核心用法 ​ 查看任务状态 ​ 建联成功后，移动端主界面展示两层状态信息： 设备级状态 ： 状态 图标 含义 在线 绿点 桌面端在线可正
- [4] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Multidevice-4.png` (33190 bytes)
  - alt: `设备状态展示`
  - src: `/docs/static/multidevice-4.fIzCGyJP.png`
  - 上下文: 核心用法 ​ 查看任务状态 ​ 建联成功后，移动端主界面展示两层状态信息： 设备级状态 ： 状态 图标 含义 在线 绿点 桌面端在线可正常交互 离线 红点 桌面端离线或网络不可达
- [5] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Multidevice-5.png` (6918 bytes)
  - alt: `设备状态展示`
  - src: `/docs/static/multidevice-4.1.CfxcOxZW.png`
  - 上下文: 对话级状态 ： 状态 含义 运行中 WorkBuddy 正在执行任务，可查看实时进展 等待输入 任务暂停等待您的确认或补充指令 已完成 任务正常结束，可查看完整执行记录 已停止 任务被手动停止，显示当前完成步数 失败 任务执行异常中断，可查看错误原因 远程继续任务 ​ 当桌面端 Wor
- [6] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Multidevice-6.png` (60259 bytes)
  - alt: `远程继续界面`
  - src: `/docs/static/multidevice-5.Dvj_aymm.png`
  - 上下文: 停止，显示当前完成步数 失败 任务执行异常中断，可查看错误原因 远程继续任务 ​ 当桌面端 WorkBuddy 执行过程中需要补充指令时，在移动端进入对应对话，直接发送消息即可继续。 在任务列表或工作空间中找到目标对话 点击进入对话详情页 在输入框发送指令，如「继续」「把刚才的改动加上日志」 指令自动路由到桌面端继续执行 在任务中通过右上角的新建图标新建任务，可以使 新建的任务在当前工作空间下执行
- [7] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Multidevice-7.png` (44362 bytes)
  - alt: `远程继续界面`
  - src: `/docs/static/multidevice-5.1.DEYvb-eP.png`
  - 上下文: 在任务中通过右上角的新建图标新建任务，可以使 新建的任务在当前工作空间下执行 。 也可以返回首页，在左下角为当前任务 新建或选择远程工作空间 ：
- [8] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Multidevice-8.png` (244506 bytes)
  - alt: `远程继续界面`
  - src: `/docs/static/multidevice-5.2.C2cpmKUZ.png`
  - 上下文: 也可以返回首页，在左下角为当前任务 新建或选择远程工作空间 ： 远程停止任务 ​ 当发现任务执行方向偏离预期，或无需继续等待时，可直接在移动端停止任务。 进入正在运行的对话，点击输入框 点击右侧的发送按钮（运行中变为停止按钮），桌面端 Agent 立即终止执行 对话状态更新为「本轮任务已停止，电脑端已同步终止运行」
- [9] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/Multidevice-9.png` (37454 bytes)
  - alt: `远程停止任务`
  - src: `/docs/static/multidevice-6.B6xxlcEv.png`
  - 上下文: 远程停止任务 ​ 当发现任务执行方向偏离预期，或无需继续等待时，可直接在移动端停止任务。 进入正在运行的对话，点击输入框 点击右侧的发送按钮（运行中变为停止按钮），桌面端 Agent 立即终止执行 对话状态更新为「本轮任务已停止，电脑端已同步终止运行」 已完成的步骤结果保留在对话中，不受影响。 最佳实践 ​ 开启锁屏远程 ：在桌面端设置中启用「锁屏远程」，确保电脑锁屏后手机仍可查看和控制 Agen

## WeChat-Open  
- URL: `https://www.workbuddy.cn/docs/workbuddyapp/features/WeChat-Open`
- 图片数: 4

### TEXT 摘要
微信文件打开 ​ 概述 ​ 在微信中收到的文件，无需下载保存，可直接前往 WorkBuddy 移动端（App） 打开 预览 或 一键加入对话交给 AI 处理 。 在微信内通过「用其他应用打开」选择 WorkBuddy 移动端（App）即可： 预览 ：在 App 内按文件类型渲染查看内容 预览后处理 ：预览页可随时返回对话框，文件自动携带为附件，无需重复选择 插入输入框 ：文件作为附件带入输入框，补充任务要求后发送，让 WorkBuddy 基于文件内容执行任务 说明 微信暂不支持直接打开 Markdown、HTML、SVG 等格式的文件。 支持的文件类型 ​ 类型 格式 打开效果 Markdown .md 渲染为排版文档预览 HTML .html、.htm 渲染为网页预览 SVG .svg 渲染为矢量图预览 前置条件 ​ 手机已安装 WorkBuddy 移动端 App（iOS / Android），并已登录账号 若打开方式列表中未显示 WorkBuddy，点击「更多打开方式」查找 iOS 与 Android 的系统「打开方式」面板样式略有差异，均可在列表中找到 WorkBuddy 操作步骤 ​ 一、在微信中选择用 WorkBuddy 打开 ​ 在微信聊天中点击收到的文件（如 html 文件） 微信提示「暂不支持打开此类文件」时，在下方的打开方式列表中选择 WorkBuddy 移动端（App） 二、选择打开方式 ​ 进入 App 后，底部弹出操作选择： 选项 说明 预览 直接进入文件预览页，按文件类型渲染展示内容（选项文案随文件类型变化，如「查看 Markdown」「查看 HTML」） 插入输入框 文件以附件卡片形式插入对话输入框，可继续输入任务要求 预览 ​ 进入预览页后，文件内容按类型渲染展示。 点击左上角的 返回 图标可回到对话框，该文件会自动携带为对话附件。 插入输入框 ​ 文件以卡片形式显示在输入框（展示文件名、类型与大小）。 在输入框中补充任务要求（如「修改网页标题为XXX」）后点击发送，WorkBuddy 将基于文件内容执行任务。 说明 单次仅支持通过该方式打开 1 个文件 ；如需处理多个文件，可返回微信继续添加。 注意事项与重点提示 ​ 信息收集与使用 ​ 收集项 类型 用途 文件内容与元数据（文件名、类型、大小） 必要 在 App 内渲染预览文件、作为附件带入对话供 AI 处理 WorkBuddy 账号信息 必要 识别用户身份，关联对话与任务记录 对话内容与任务记录 必要 基于加入的文件执行任务并展示处理结果 文件临时缓存 非必要 应用会话期间临时保留文件以供预览和引用，清理 App 缓存或退出登录后不再保留 权限边界 ​ 仅处理您在微信中主动选择「用其他应用打开」的单个文件 不主动读取您的微信聊天记录或其他文件 AI 处理以您本人身份和授权范围执行，不超出您已有的权限范围 安全提示 ​ 文件通过腾讯安全通道传输与处理，全程加密 仅在将文件「插入输入框」并发送任务后，文件内容才会用于 AI 处理 来源不明的文件建议先「预览」确认内容后，再决定是否插入输入框 积分消耗提醒 ​ 预览文件本身不消耗积分；将文件插入输入框并发送任务后，AI 理解、汇总文件内容时会消耗积分，与常规对话一致。 免责声明 ​ 通过本功能打开的文件由您自行选择和提供，WorkBuddy 不预设文件用途，请审慎评估文件来源与内容后再插入输入框处理。 使用建议 ​ 收到 Markdown / HTML / SVG 文件时，建议先「查看」快速确认内容，再决定是否加入对话，避免无效任务消耗 涉及敏感信息的文件，建议在任务完成后及时删除对应对话记录 声明 ​ 本节说明，构成 服务协议 、 隐私保护（PC端） 、 隐私保护（小程序端） 和 隐私保护（移动端） 指引的组成部分，具有同等法律效力。如有不一致之处，以前述协议原文为准。

### 章节标题
- H2: 入门指南
- H2: 功能说明
- H2: 概述 ​
- H2: 支持的文件类型 ​
- H2: 前置条件 ​
- H2: 操作步骤 ​
- H3: 一、在微信中选择用 WorkBuddy 打开 ​
- H3: 二、选择打开方式 ​
- H2: 注意事项与重点提示 ​
- H3: 信息收集与使用 ​
- H3: 权限边界 ​
- H3: 安全提示 ​
- H3: 积分消耗提醒 ​
- H3: 免责声明 ​
- H3: 使用建议 ​
- H2: 声明 ​

### 图片清单
- [1] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/WeChat-Open-1.png` (62198 bytes)
  - alt: `微信内选择用 WorkBuddy 打开文件`
  - src: `/docs/static/wechat-open-1.tBmGkR-p.png`
  - 上下文: 」查找 iOS 与 Android 的系统「打开方式」面板样式略有差异，均可在列表中找到 WorkBuddy 操作步骤 ​ 一、在微信中选择用 WorkBuddy 打开 ​ 在微信聊天中点击收到的文件（如 html 文件） 微信提示「暂不支持打开此类文件」时，在下方的打开方式列表中选择 WorkBuddy 移动端（App） 二、选择打开方式 ​ 进入 App 后，底部弹出操作选择：
- [2] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/WeChat-Open-2.png` (67066 bytes)
  - alt: `选择预览文件或插入输入框`
  - src: `/docs/static/wechat-open-2.BlOIPXsu.png`
  - 上下文: 二、选择打开方式 ​ 进入 App 后，底部弹出操作选择： 选项 说明 预览 直接进入文件预览页，按文件类型渲染展示内容（选项文案随文件类型变化，如「查看 Markdown」「查看 HTML」） 插入输入框 文件以附件卡片形式插入对话输入框，可继续输入任务要求 预览 ​ 进入预览页后，文件内容按类型渲染展示。 点击左上角的 返回 图标可回到对话框，该文件会
- [3] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/WeChat-Open-3.png` (134127 bytes)
  - alt: `在 App 内预览 HTML 文件`
  - src: `/docs/static/wechat-open-3.YSN9lPTY.png`
  - 上下文: 预览 直接进入文件预览页，按文件类型渲染展示内容（选项文案随文件类型变化，如「查看 Markdown」「查看 HTML」） 插入输入框 文件以附件卡片形式插入对话输入框，可继续输入任务要求 预览 ​ 进入预览页后，文件内容按类型渲染展示。 点击左上角的 返回 图标可回到对话框，该文件会自动携带为对话附件。 插入输入框 ​ 文件以卡片形式显示在输入框（展示文件名、类型与大小）。 在输入框中补充任务要
- [4] `/Users/yason/local/openwork/prds/workbuddy-refactor/workbuddy-docs-research/img/mobile/WeChat-Open-4.png` (193647 bytes)
  - alt: `文件以附件卡片插入对话输入框`
  - src: `/docs/static/wechat-open-4.rzotN31e.png`
  - 上下文: 插入输入框 ​ 文件以卡片形式显示在输入框（展示文件名、类型与大小）。 在输入框中补充任务要求（如「修改网页标题为XXX」）后点击发送，WorkBuddy 将基于文件内容执行任务。 说明 单次仅支持通过该方式打开 1 个文件 ；如需处理多个文件，可返回微信继续添加。 注意事项与重点提示 ​ 信息收集与使用 ​ 收集项 类型 用途 文件内容与元数据（文件名、类型、大小） 必要 在 App 内渲染预览

---
## 汇总
- **页面总数**：11
- **图片总数**：60

### 每页图片数
- Homepage: 5
- Sidebar: 2
- Task-Execution: 7
- Share: 5
- Create-Task: 5
- Attachments-and-Skills: 13
- Auto: 4
- Expert: 4
- Model: 2
- Multidevice: 9
- WeChat-Open: 4
