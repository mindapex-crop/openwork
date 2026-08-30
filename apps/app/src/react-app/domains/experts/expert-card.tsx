/** @jsxImportSource react */
import { Edit3, Trash2, User, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MarbleAvatar } from "@/react-app/design-system/marble-avatar";

import type { Expert } from "./types";

export type ExpertCardProps = {
  expert: Expert;
  onOpen?: (expert: Expert) => void;
  onEdit?: (expert: Expert) => void;
  onDelete?: (expert: Expert) => void;
};

export function ExpertCard(props: ExpertCardProps) {
  const { expert } = props;
  const openExpert = props.onOpen ? () => props.onOpen?.(expert) : undefined;

  return (
    <Card
      variant="default"
      size="sm"
      className="h-full cursor-pointer transition-all hover:ring-2 hover:ring-primary/30"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          {expert.avatar ? (
            <img
              src={expert.avatar}
              alt=""
              loading="lazy"
              className="size-12 shrink-0 rounded-xl object-cover"
              onClick={openExpert}
            />
          ) : (
            <div onClick={openExpert} className="cursor-pointer">
              <MarbleAvatar seed={expert.name || expert.id} className="size-12 shrink-0" square />
            </div>
          )}
          <div className="min-w-0 flex-1" onClick={openExpert}>
            <CardTitle className="line-clamp-1 text-sm font-semibold">{expert.name}</CardTitle>
            {expert.author ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <User className="size-3" />
                <span className="line-clamp-1">{expert.author}</span>
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2.5" onClick={openExpert}>
        <CardDescription className="line-clamp-3 leading-relaxed">
          {expert.description || "—"}
        </CardDescription>
        {expert.skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {expert.skills.slice(0, 4).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-[10px]">
                {skill}
              </Badge>
            ))}
            {expert.skills.length > 4 ? (
              <Badge variant="secondary" className="text-[10px]">
                +{expert.skills.length - 4}
              </Badge>
            ) : null}
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={(event) => {
              event.stopPropagation();
              props.onOpen?.(expert);
            }}
          >
            <Zap className="size-3" />
            召唤专家
          </Button>
          <div className="flex shrink-0 gap-1">
            {props.onEdit ? (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onEdit?.(expert);
                }}
                aria-label={`Edit ${expert.name}`}
              >
                <Edit3 className="size-3.5" />
              </Button>
            ) : null}
            {props.onDelete ? (
              <Button
                variant="ghost"
                size="icon-sm"
                className="hover:text-destructive"
                onClick={(event) => {
                  event.stopPropagation();
                  props.onDelete?.(expert);
                }}
                aria-label={`Delete ${expert.name}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
