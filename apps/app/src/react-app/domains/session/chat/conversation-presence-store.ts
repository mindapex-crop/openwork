import { create } from "zustand";

/**
 * 会话是否存在对话（transcript 是否非空）的轻量信号。
 * WorkBuddy 对标：未产生对话时右侧结果区（产物/工作空间文件/变更）不可展开。
 * SessionSurface 在渲染消息数变化时写入；session-page 据此禁用/启用 rail 按钮。
 */
type ConversationPresenceStore = {
  bySessionId: Record<string, boolean>;
  setPresence: (sessionId: string, hasMessages: boolean) => void;
};

export const useConversationPresenceStore = create<ConversationPresenceStore>((set) => ({
  bySessionId: {},
  setPresence: (sessionId, hasMessages) => set((state) => {
    if (state.bySessionId[sessionId] === hasMessages) return state;
    return { bySessionId: { ...state.bySessionId, [sessionId]: hasMessages } };
  }),
}));

export function hasSessionConversation(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return useConversationPresenceStore.getState().bySessionId[sessionId] === true;
}
