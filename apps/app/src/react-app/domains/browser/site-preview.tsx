/** @jsxImportSource react */
import { useState } from "react";
import { Monitor, Tablet, Smartphone, Maximize2, Minimize2, RefreshCw, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/sonner";

type Viewport = "desktop" | "tablet" | "mobile";

interface SitePreviewProps {
  url: string;
  onReload?: () => void;
  viewport?: Viewport;
}

const VIEWPORT_WIDTHS: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
};

const VIEWPORT_LABELS: Record<Viewport, string> = {
  desktop: "Desktop",
  tablet: "Tablet (768px)",
  mobile: "Mobile (375px)",
};

export function SitePreview({ url, onReload, viewport: initialViewport = "desktop" }: SitePreviewProps) {
  const [currentViewport, setCurrentViewport] = useState<Viewport>(initialViewport);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(Date.now());

  const handleReload = () => {
    if (onReload) {
      onReload();
    } else {
      setIframeKey(Date.now());
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Preview URL copied to clipboard");
    } catch {
      toast.error("Failed to copy URL to clipboard");
    }
  };

  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="shrink-0 border-b border-border bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger render={(
                <Button
                  variant={currentViewport === "desktop" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCurrentViewport("desktop")}
                  aria-label="Desktop viewport"
                >
                  <Monitor />
                </Button>
              )} />
              <TooltipContent>Desktop view</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={(
                <Button
                  variant={currentViewport === "tablet" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCurrentViewport("tablet")}
                  aria-label="Tablet viewport"
                >
                  <Tablet />
                </Button>
              )} />
              <TooltipContent>Tablet view (768px)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={(
                <Button
                  variant={currentViewport === "mobile" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setCurrentViewport("mobile")}
                  aria-label="Mobile viewport"
                >
                  <Smartphone />
                </Button>
              )} />
              <TooltipContent>Mobile view (375px)</TooltipContent>
            </Tooltip>
          </div>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">{VIEWPORT_LABELS[currentViewport]}</span>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger render={(
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleReload}
                  aria-label="Reload preview"
                >
                  <RefreshCw />
                </Button>
              )} />
              <TooltipContent>Reload preview</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={(
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleShare}
                  aria-label="Copy preview URL"
                >
                  <Share />
                </Button>
              )} />
              <TooltipContent>Copy preview URL</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={(
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                >
                  {isFullscreen ? <Minimize2 /> : <Maximize2 />}
                </Button>
              )} />
              <TooltipContent>{isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
      <div
        className={`flex-1 overflow-auto p-4 ${isFullscreen ? "fixed inset-0 z-50 bg-background" : ""}`}
      >
        <div
          className="mx-auto transition-all duration-200"
          style={{
            width: isFullscreen ? "100%" : VIEWPORT_WIDTHS[currentViewport],
            height: "100%",
          }}
        >
          <iframe
            key={iframeKey}
            src={url}
            title="Site Preview"
            className="h-full w-full rounded-lg border border-border bg-white shadow-sm"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            allow="fullscreen; autoplay"
          />
        </div>
      </div>
    </div>
  );
}
