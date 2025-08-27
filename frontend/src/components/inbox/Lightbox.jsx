import React, { useEffect, useState } from 'react';

export default function Lightbox({ items = [], startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex);
  const total = items.length;
  useEffect(() => { setIndex(startIndex); }, [startIndex]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % total);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + total) % total);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, total]);
  if (!total) return null;
  const item = items[index] || items[0];
  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
      onClick={onClose}
      data-testid="lightbox"
    >
      <img
        src={item.src || item.url}
        alt="media"
        className="max-w-[92vw] max-h-[88vh] rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
