import { Button } from "./Button";

interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onChange: (page: number) => void;
}

/** Works for both list shapes in the spec: it derives the last page from totalItems, as not every list sends lastPage. */
export function Pagination({ page, pageSize, totalItems, onChange }: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
      <span>
        {from}–{to} of {totalItems}
      </span>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </Button>
        <span>
          {page} / {lastPage}
        </span>
        <Button size="sm" variant="ghost" disabled={page >= lastPage} onClick={() => onChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
