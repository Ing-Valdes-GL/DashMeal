import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, total, limit, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages = getPageNumbers(page, totalPages);

  return (
    <div className={cn("flex items-center justify-between px-2", className)}>
      <p className="text-xs text-slate-500">
        {from}–{to} sur {total} résultats
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-500">
              <MoreHorizontal className="h-4 w-4" />
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => onPageChange(p as number)}
              className={cn(p === page && "text-xs")}
            >
              {p}
            </Button>
          )
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 3) return [1, 2, 3, 4, "...", total];
  if (current >= total - 2) return [1, "...", total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}
