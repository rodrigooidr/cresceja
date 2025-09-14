export default function Pager({ hasPrev, hasNext, onPrev, onNext }) {
  return (
    <nav aria-label="Pagination">
      <button
        type="button"
        aria-label="Previous"
        data-testid="pager-prev"
        onClick={onPrev}
        disabled={!hasPrev}
      >
        Previous
      </button>
      <button
        type="button"
        aria-label="Next"
        data-testid="pager-next"
        onClick={onNext}
        disabled={!hasNext}
      >
        Next
      </button>
    </nav>
  );
}
