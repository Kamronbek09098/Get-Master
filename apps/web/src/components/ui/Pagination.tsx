import { Button } from './Button';
import './Pagination.css';

export interface PaginationProps {
  hasMore: boolean;
  loading?: boolean;
  onLoadMore: () => void;
}

export function Pagination({ hasMore, loading, onLoadMore }: PaginationProps) {
  if (!hasMore) return null;
  return (
    <div className="gm-pagination">
      <Button variant="secondary" size="sm" loading={loading} onClick={onLoadMore}>
        Ko‘proq yuklash
      </Button>
    </div>
  );
}
