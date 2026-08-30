/**
 * Composer 能力选择状态：「+」菜单里的智能体 / 连接器选中项。
 *
 * 单独成 store 是因为写入方是 composer 菜单、读取方是 session-route 的发送
 * 路径（首条任务框定），两者不在同一组件树。选择是一次性的：首条任务发出后
 * 由发送路径 clear，避免污染后续任务。
 */

import { create } from "zustand";

import { useExpertsStore } from "@/react-app/domains/experts/experts-store";
import { IM_CONNECTOR_DEFINITIONS } from "@/react-app/domains/settings/im-connector-store";

import {
  type CapabilityContext,
  type ComposerCapabilities,
  EMPTY_COMPOSER_CAPABILITIES,
} from "./composer-capabilities";

type ComposerCapabilityStore = ComposerCapabilities & {
  setExpert: (expertId: string | null) => void;
  toggleConnector: (connectorId: string) => void;
  clear: () => void;
};

export const useComposerCapabilityStore = create<ComposerCapabilityStore>((set, get) => ({
  ...EMPTY_COMPOSER_CAPABILITIES,

  setExpert: (expertId) => set({ expertId }),

  toggleConnector: (connectorId) => {
    const current = get().connectorIds;
    set({
      connectorIds: current.includes(connectorId)
        ? current.filter((id) => id !== connectorId)
        : [...current, connectorId],
    });
  },

  clear: () => set({ ...EMPTY_COMPOSER_CAPABILITIES }),
}));

/**
 * 把 store 里的 id 解析成框定所需的描述符。专家清单来自 `useExpertsStore`
 * （由 composer 菜单负责懒加载）；连接器 label 来自平台定义。
 */
export function resolveCapabilityContext(): CapabilityContext {
  const { expertId, connectorIds } = useComposerCapabilityStore.getState();
  const expert = expertId
    ? useExpertsStore.getState().experts.find((entry) => entry.id === expertId) ?? null
    : null;
  return {
    expert: expert
      ? { name: expert.name, systemPrompt: expert.systemPrompt, skills: expert.skills }
      : null,
    connectorLabels: connectorIds.map(
      (id) => IM_CONNECTOR_DEFINITIONS.find((definition) => definition.id === id)?.name ?? id,
    ),
  };
}

export function hasComposerCapabilities(): boolean {
  const { expertId, connectorIds } = useComposerCapabilityStore.getState();
  return expertId !== null || connectorIds.length > 0;
}
