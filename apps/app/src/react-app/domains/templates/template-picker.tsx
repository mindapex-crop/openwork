import * as React from "react";
import { FileCode, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CODE_TEMPLATES, type CodeTemplate } from "./code-templates";

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: CodeTemplate) => void;
}

export function TemplatePicker({ open, onOpenChange, onSelect }: TemplatePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a Project Template</DialogTitle>
          <DialogDescription>
            Start with a pre-configured template to bootstrap your project quickly.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {CODE_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onSelect(template)}
              className="flex flex-col items-start p-4 border rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileCode className="h-5 w-5 text-blue-600" />
                <span className="font-semibold text-gray-900">{template.name}</span>
              </div>
              <p className="text-sm text-gray-600 mb-2">{template.description}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="px-2 py-1 bg-gray-100 rounded">{template.language}</span>
                <span>{template.files.length} files</span>
              </div>
            </button>
          ))}

          <button
            onClick={() => onSelect({ id: "blank", name: "Blank Project", description: "Start from scratch", language: "", files: [] })}
            className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors min-h-[120px]"
          >
            <Plus className="h-8 w-8 text-gray-400 mb-2" />
            <span className="font-medium text-gray-700">Start from Scratch</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
