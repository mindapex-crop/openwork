/**
 * 双语词典（zh / en）。命名对齐桌面端 i18n key（apps/app/src/i18n/locales）：
 * sidebar.assistant=助理、sidebar.experts=专家、sidebar.skills=技能、
 * sidebar.connectors=连接器、sidebar.library=资料库、sidebar.automations=自动化、
 * sidebar.projects=项目、sidebar.inspiration=灵感。
 */

export type Language = "zh" | "en";

export const SUPPORTED_LANGUAGES: Language[] = ["zh", "en"];

export interface I18nDictionary {
  [key: string]: string;
}

export const zh: I18nDictionary = {
  "nav.assistant": "助理",
  "nav.experts": "专家",
  "nav.skills": "技能",
  "nav.connectors": "连接器",
  "nav.library": "资料库",
  "nav.automations": "自动化",
  "nav.projects": "项目",
  "nav.inspiration": "灵感",
  "nav.settings": "设置",

  "home.title": "助理",
  "home.newSession": "新建会话",
  "home.empty": "还没有会话",
  "home.emptyHint": "点击右上角「新建会话」开始对话",
  "home.loadFailed": "会话列表加载失败",
  "home.offlineHint": "无法连接 openwork-server，请检查服务器地址",

  "chat.title": "聊天",
  "chat.inputPlaceholder": "输入消息…",
  "chat.send": "发送",
  "chat.empty": "开始对话吧",
  "chat.messagesFailed": "消息加载失败",
  "chat.sendFailed": "发送失败，请重试",
  "chat.sending": "发送中…",

  "experts.title": "专家",
  "experts.empty": "暂无专家",
  "experts.detail": "专家详情",
  "experts.systemPrompt": "系统提示词",
  "experts.methodology": "方法论",
  "experts.skills": "技能",
  "experts.model": "模型偏好",
  "experts.source": "来源",

  "projects.title": "项目",
  "projects.empty": "暂无项目",
  "projects.loadFailed": "加载项目失败",
  "projects.mockNote": "移动端暂未对接项目 API，以下为示例数据",

  "automations.title": "自动化",
  "automations.empty": "暂无自动化",
  "automations.loadFailed": "加载自动化失败",
  "automations.mockNote": "移动端暂未对接自动化 API，以下为示例数据",
  "automations.enabled": "已启用",
  "automations.disabled": "已停用",

  "models.title": "模型选择",
  "models.select_title": "选择模型",
  "models.empty": "暂无可用模型",
  "models.loadFailed": "加载模型失败",

  "settings.title": "设置",
  "settings.language": "语言",
  "settings.languageSystem": "跟随系统",
  "settings.serverUrl": "服务器地址",
  "settings.token": "访问令牌（可选）",
  "settings.workspaceId": "工作区 ID（可选，留空自动探测）",
  "settings.save": "保存",
  "settings.saved": "已保存",
  "settings.about": "OpenWork 移动端 · 阶段四",

  "pairing.title": "配对设备",
  "pairing.desc": "输入桌面端显示的 6 位配对码完成配对",
  "pairing.pairCode": "配对码",
  "pairing.deviceName": "设备名称",
  "pairing.deviceNamePlaceholder": "如：iPhone 15",
  "pairing.submit": "配对",
  "pairing.pairing": "配对中…",
  "pairing.success": "配对成功",
  "pairing.error": "配对失败，请检查配对码是否正确",
  "pairing.errorExpired": "配对码已过期，请在桌面端重新生成",

  "common.retry": "重试",
  "common.cancel": "取消",
  "common.loading": "加载中…",
  "common.error": "出错了",
  "common.offline": "无法连接服务器，请检查网络或服务器地址",
};

export const en: I18nDictionary = {
  "nav.assistant": "Assistant",
  "nav.experts": "Experts",
  "nav.skills": "Skills",
  "nav.connectors": "Connectors",
  "nav.library": "Library",
  "nav.automations": "Automations",
  "nav.projects": "Projects",
  "nav.inspiration": "Inspiration",
  "nav.settings": "Settings",

  "home.title": "Assistant",
  "home.newSession": "New Session",
  "home.empty": "No sessions yet",
  "home.emptyHint": "Tap \u201cNew Session\u201d in the top-right to start",
  "home.loadFailed": "Failed to load sessions",
  "home.offlineHint": "Cannot reach openwork-server, check the server URL",

  "chat.title": "Chat",
  "chat.inputPlaceholder": "Type a message…",
  "chat.send": "Send",
  "chat.empty": "Say hello to start",
  "chat.messagesFailed": "Failed to load messages",
  "chat.sendFailed": "Send failed, please retry",
  "chat.sending": "Sending…",

  "experts.title": "Experts",
  "experts.empty": "No experts yet",
  "experts.detail": "Expert Details",
  "experts.systemPrompt": "System Prompt",
  "experts.methodology": "Methodology",
  "experts.skills": "Skills",
  "experts.model": "Model",
  "experts.source": "Source",

  "projects.title": "Projects",
  "projects.empty": "No projects yet",
  "projects.loadFailed": "Failed to load projects",
  "projects.mockNote": "Mobile project API is not wired yet, showing sample data",

  "automations.title": "Automations",
  "automations.empty": "No automations yet",
  "automations.loadFailed": "Failed to load automations",
  "automations.mockNote": "Mobile automation API is not wired yet, showing sample data",
  "automations.enabled": "Enabled",
  "automations.disabled": "Disabled",

  "models.title": "Model Selection",
  "models.select_title": "Select Model",
  "models.empty": "No models available",
  "models.loadFailed": "Failed to load models",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.languageSystem": "System default",
  "settings.serverUrl": "Server URL",
  "settings.token": "Access token (optional)",
  "settings.workspaceId": "Workspace ID (optional, auto-detect if empty)",
  "settings.save": "Save",
  "settings.saved": "Saved",
  "settings.about": "OpenWork Mobile · Phase 4",

  "pairing.title": "Pair Device",
  "pairing.desc": "Enter the 6-digit pairing code shown on the desktop",
  "pairing.pairCode": "Pairing Code",
  "pairing.deviceName": "Device Name",
  "pairing.deviceNamePlaceholder": "e.g. iPhone 15",
  "pairing.submit": "Pair",
  "pairing.pairing": "Pairing…",
  "pairing.success": "Paired successfully",
  "pairing.error": "Pairing failed, check the pairing code",
  "pairing.errorExpired": "Pairing code expired, regenerate on desktop",

  "common.retry": "Retry",
  "common.cancel": "Cancel",
  "common.loading": "Loading…",
  "common.error": "Something went wrong",
  "common.offline": "Cannot reach the server. Check network or server URL",
};

export const dictionaries: Record<Language, I18nDictionary> = { zh, en };

/** 翻译：支持 {name} 占位符插值 */
export function translate(
  lang: Language,
  key: string,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[lang] ?? en;
  let template = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      template = template.replaceAll(`{${name}}`, String(value));
    }
  }
  return template;
}

/** 系统语言 → 支持的语言；不支持则回退 en（默认跟随设备语言） */
export function resolveLanguage(languageCode: string | null | undefined): Language {
  if (!languageCode) return "en";
  const normalized = languageCode.toLowerCase().split("-")[0];
  return normalized === "zh" ? "zh" : "en";
}
