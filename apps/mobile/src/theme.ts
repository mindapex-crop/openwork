/** 全局主题色板（对齐桌面端深色基调，WorkBuddy 移动版观感） */
export const theme = {
  colors: {
    background: "#0F1115",
    surface: "#171A21",
    surfaceAlt: "#1F2430",
    border: "#2A3040",
    primary: "#4C8DFF",
    primarySoft: "#2B3A5C",
    text: "#E6E9F0",
    textSecondary: "#9AA3B2",
    textMuted: "#6B7484",
    danger: "#E5484D",
    success: "#46A758",
    warning: "#F5A524",
    chatUserBubble: "#2B3A5C",
    chatAssistantBubble: "#1F2430",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    pill: 999,
  },
  typography: {
    title: 20,
    heading: 17,
    body: 15,
    caption: 13,
    small: 12,
  },
} as const;

export type Theme = typeof theme;
