// src/pages/inbox/components/Lightbox.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props:
 * - images: Array<{ url: string, alt?: string }>
 * - startIndex?: number
 * - onClose: () => void
 */
export default function Lightbox({ images = [], startIndex = 0, onClose }) {
  const [index, setIndex] = useState(Math.min(Math.max(startIndex, 0), Math.max(images.length - 1, 0)));
  const [zoom, setZoom] = useState(1);
  const imgRef = useRef(null);

  const current = images[index] || null;

  const canPrev = index > 0;
  const canNext = index < images.length - 1;

  const goPrev = () => {
    if (!canPrev) return;
    setIndex((i) => Math.max(i - 1, 0));
    setZoom(1);
  };
  const goNext = () => {
    if (!canNext) return;
    setIndex((i) => Math.min(i + 1, images.length - 1));
    setZoom(1);
  };

  const wheelZoom = (e) => {
    // Ctrl + wheel para zoom (ou use trackpad pinch que vira wheel + ctrl)
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setZoom((z) => clamp(z + delta, 0.5, 4));
    }
  };

  // Teclado
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "+" || e.key === "=") setZoom((z) => clamp(z + 0.1, 0.5, 4));
      if (e.key === "-") setZoom((z) => clamp(z - 0.1, 0.5, 4));
      if (e.key.toLowerCase() === "r") setZoom(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, index]);

  // Evita scroll da página
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const thumbs = useMemo(() => images.map((img, i) => ({ ...img, i })), [images]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/80 flex flex-col"
      onWheel={wheelZoom}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between text-white px-4 py-3">
        <div className="text-sm">
          {index + 1} / {images.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2 py-1 border rounded-md"
            onClick={() => setZoom((z) => clamp(z + 0.1, 0.5, 4))}
            title="Zoom in (+)"
          >
            +
          </button>
          <button
            className="px-2 py-1 border rounded-md"
            onClick={() => setZoom((z) => clamp(z - 0.1, 0.5, 4))}
            title="Zoom out (-)"
          >
            −
          </button>
          <button
            className="px-2 py-1 border rounded-md"
            onClick={() => setZoom(1)}
            title="Reset zoom (R)"
          >
            100%
          </button>
          <button
            className="px-2 py-1 border rounded-md"
            onClick={onClose}
            title="Fechar (Esc)"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Viewer */}
      <div className="flex-1 relative select-none">
        {/* Navegação lateral */}
        <button
          className="absolute left-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-md bg-white/20 text-white hover:bg-white/30 disabled:opacity-40"
          onClick={goPrev}
          disabled={!canPrev}
          title="Anterior (←)"
        >
          ‹
        </button>
        <button
          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-md bg-white/20 text-white hover:bg-white/30 disabled:opacity-40"
          onClick={goNext}
          disabled={!canNext}
          title="Próxima (→)"
        >
          ›
        </button>

        {/* Imagem */}
        <div className="h-full w-full flex items-center justify-center p-4">
          <img
            ref={imgRef}
            src={current.url}
            alt={current.alt || ""}
            className="max-h-full max-w-full"
            style={{ transform: `scale(${zoom})` }}
            draggable={false}
          />
        </div>
      </div>

      {/* Thumbs */}
      {thumbs.length > 1 && (
        <div className="w-full overflow-x-auto bg-black/60 py-2 px-3">
          <div className="flex gap-2">
            {thumbs.map((t) => (
              <button
                key={t.i + (t.url || "")}
                className={`shrink-0 w-16 h-16 border-2 rounded-md overflow-hidden ${
                  t.i === index ? "border-white" : "border-transparent opacity-70 hover:opacity-100"
                }`}
                onClick={() => { setIndex(t.i); setZoom(1); }}
                title={`Imagem ${t.i + 1}`}
              >
                <img src={t.url} alt={t.alt || ""} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
