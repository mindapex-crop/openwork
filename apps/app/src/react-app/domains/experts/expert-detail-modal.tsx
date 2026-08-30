/** @jsxImportSource react */
import { MessageCircle, X, Zap } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MarbleAvatar } from "@/react-app/design-system/marble-avatar";
import type { Expert } from "./types";

export type ExpertDetailModalProps = {
  expert: Expert | null;
  open: boolean;
  onClose: () => void;
  onSummon?: (expert: Expert) => void;
};

export function ExpertDetailModal({ expert, open, onClose, onSummon }: ExpertDetailModalProps) {
  if (!open || !expert) return null;

  const exampleRequests = expert.skills.length > 0
    ? [
        `用「${expert.skills[0]}」帮我处理一个任务`,
        `请${expert.name}帮我分析一下项目`,
        `让${expert.name}生成一份专业报告`,
      ]
    : [
        `帮我创建一个关于${expert.name}的任务`,
        `使用${expert.name}来分析我的项目`,
        `让${expert.name}帮我生成一份报告`,
      ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-6 pb-4">
          <div className="flex items-center gap-4">
            {expert.avatar ? (
              <img
                src={expert.avatar}
                alt=""
                className="size-16 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <MarbleAvatar seed={expert.name || expert.id} className="size-16 shrink-0" square />
            )}
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-gray-900">{expert.name}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Description */}
        <div className="px-6 py-4">
          <p className="text-sm leading-relaxed text-gray-600">
            {expert.description || expert.systemPrompt || "暂无描述"}
          </p>
          {expert.skills.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {expert.skills.slice(0, 6).map((skill) => (
                <span
                  key={skill}
                  className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                >
                  {skill}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Summon CTA */}
        <div className="px-6 py-3">
          <Button
            className="w-full bg-gray-900 text-white hover:bg-gray-800"
            size="lg"
            onClick={() => onSummon?.(expert)}
          >
            <Zap size={16} />
            召唤专家
          </Button>
        </div>

        {/* Example requests */}
        <div className="border-t border-gray-100 px-6 py-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-900">
            <Zap className="size-4" />
            专家帮你做
          </h3>
          <div className="flex flex-col gap-2">
            {exampleRequests.map((request, i) => (
              <button
                key={i}
                type="button"
                className="group flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 px-4 py-3 text-left text-sm text-gray-600 transition-colors hover:border-gray-200 hover:bg-gray-50"
                onClick={() => onSummon?.(expert)}
              >
                <span className="mt-0.5 text-gray-300 group-hover:text-gray-900">"</span>
                <span className="flex-1 leading-relaxed">{request}</span>
                <MessageCircle className="mt-0.5 size-4 shrink-0 text-gray-300 group-hover:text-gray-500" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}