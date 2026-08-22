/** @jsxImportSource react */
import { Cpu, Settings2, Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsSection,
  SettingsSectionHeader,
  SettingsSectionHeaderActions,
  SettingsSectionHeaderContent,
  SettingsSectionHeaderDescription,
  SettingsSectionHeaderTitle,
  SettingsSectionHint,
} from "./settings-section";
import { useCollabMode, type CollabMode } from "./state/feature-flags-preferences";

const COLLAB_MODE_OPTIONS: {
  value: CollabMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "simple", label: "普通模式", icon: Users },
  { value: "cli", label: "程序员模式（多 CLI Agent 合作）", icon: Cpu },
  { value: "advanced", label: "专家模式（手动编排团队）", icon: Settings2 },
];

const COLLAB_MODE_HINTS: Record<CollabMode, string> = {
  simple:
    "普通模式：一键协作，AI 团队自动帮你搞定，隐藏 CLI 与团队配置，面向非技术用户。",
  cli:
    "程序员模式：多 CLI Agent 自动编排合作，侧边栏协作入口显示完整团队面板，支持手动选 agent 与策略。",
  advanced:
    "专家模式：手动编排 agent 团队，可选执行策略（保守/平衡/激进）、Harness 环境（本地/SSH/云端/容器）和成员角色，适合复杂任务与团队治理。",
};

function isCollabMode(value: string | null): value is CollabMode {
  return value === "simple" || value === "cli" || value === "advanced";
}

export function CollabModeSection() {
  const { collabMode, setCollabMode } = useCollabMode();

  return (
    <SettingsSection>
      <SettingsSectionHeader>
        <SettingsSectionHeaderContent>
          <SettingsSectionHeaderTitle>
            <Users className="size-4" />
            协作模式
          </SettingsSectionHeaderTitle>
          <SettingsSectionHeaderDescription>
            选择你使用 AI 团队的方式。
          </SettingsSectionHeaderDescription>
        </SettingsSectionHeaderContent>
        <SettingsSectionHeaderActions>
          <div className="w-64 max-w-full">
            <Select
              value={collabMode}
              items={COLLAB_MODE_OPTIONS}
              onValueChange={(value) => {
                if (isCollabMode(value)) setCollabMode(value);
              }}
            >
              <SelectTrigger className="w-full" aria-label="协作模式">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {COLLAB_MODE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="size-4" />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </SettingsSectionHeaderActions>
      </SettingsSectionHeader>
      <SettingsSectionHint>{COLLAB_MODE_HINTS[collabMode]}</SettingsSectionHint>
    </SettingsSection>
  );
}