/** @jsxImportSource react */
import { t } from '@/i18n';

export interface CursorIndicatorProps {
  userId: string;
  userName: string;
  color: string;
  position: { x: number; y: number };
}

export function CursorIndicator({ userId, userName, color, position }: CursorIndicatorProps) {
  return (
    <div
      className="pointer-events-none absolute z-50 transition-all duration-200 ease-out"
      style={{
        left: position.x,
        top: position.y,
      }}
      aria-label={t('collab.cursor_indicator', { name: userName })}
    >
      <div
        className="relative flex items-center gap-1.5"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        <div
          className="h-3 w-3 rounded-full ring-2 ring-white dark:ring-gray-900"
          style={{ backgroundColor: color }}
        />
        <span
          className="whitespace-nowrap rounded-md bg-background px-2 py-0.5 text-xs font-medium shadow-sm ring-1 ring-border"
          style={{ color }}
        >
          {userName}
        </span>
      </div>
    </div>
  );
}
