import type { PageData } from "../../data/api";
export function Pagination({
  page,
  onChange,
}: {
  page?: PageData<unknown>["page"];
  onChange: (offset: number) => void;
}) {
  if (!page) return null;
  return (
    <nav className="api-pagination" aria-label="分頁">
      <button
        className="button secondary"
        disabled={page.offset === 0}
        onClick={() => onChange(Math.max(0, page.offset - page.limit))}
      >
        上一頁
      </button>
      <span>
        共 {page.total} 筆 · 第 {Math.floor(page.offset / page.limit) + 1} 頁
      </span>
      <button
        className="button secondary"
        disabled={page.offset + page.limit >= page.total}
        onClick={() => onChange(page.offset + page.limit)}
      >
        下一頁
      </button>
    </nav>
  );
}
