// src/pages/inbox/components/AttachmentPreview.jsx
import React, { useEffect, useMemo, useRef } from "react";

/**
 * Props:
 * - files: File[]
 * - onRemove?: (file: File) => void
 * - onOpenLightbox?: (index: number) => void
 * - maxThumbs?: number
 */
export default function AttachmentPreview({
  files,
  onRemove,
  onOpenLightbox,
  maxThumbs = 6,
}) {
  const empty = !files || files.length === 0;

  // Hooks DEVEM ficar sempre no topo (sem condicionais)
  const urlsRef = useRef([]);
  const isImage = (f) => /^image\//.test(f.type);

  const items = useMemo(() => {
    if (empty) {
      // limpa urls antigas se vier de um estado não-vazio
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
      return { visible: [], hiddenCount: 0 };
    }

    const visible = files.slice(0, maxThumbs);
    // libera URLs antigas
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    const mapped = visible.map((f) => {
      const obj = { file: f, isImage: isImage(f), url: null };
      if (obj.isImage) {
        const u = URL.createObjectURL(f);
        urlsRef.current.push(u);
        obj.url = u;
      }
      return obj;
    });
    return {
      visible: mapped,
      hiddenCount: Math.max(files.length - maxThumbs, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empty, files, maxThumbs]);

  useEffect(() => {
    // cleanup ao desmontar
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current = [];
    };
  }, []);

  // Agora pode retornar condicionalmente sem violar a regra
  if (empty) return null;

  return (
    <div className="attachment-preview mt-2">
      <div className="flex flex-wrap gap-2">
        {items.visible.map((item, idx) => (
          <PreviewBox
            key={item.file.name + ":" + item.file.size}
            item={item}
            index={idx}
            onRemove={onRemove}
            onOpenLightbox={onOpenLightbox}
          />
        ))}
        {items.hiddenCount > 0 && (
          <div className="w-16 h-16 border rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-600">
            +{items.hiddenCount}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewBox({ item, index, onRemove, onOpenLightbox }) {
  const { file, isImage, url } = item;

  const handleOpen = () => {
    if (isImage && typeof onOpenLightbox === "function") {
      onOpenLightbox(index);
    } else {
      const blobUrl = URL.createObjectURL(file);
      window.open(blobUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    }
  };

  return (
    <div className="relative group">
      <div
        className="w-16 h-16 border rounded-lg overflow-hidden bg-white flex items-center justify-center cursor-pointer"
        title={`${file.name} (${Math.round(file.size / 1024)} KB)`}
        onClick={handleOpen}
      >
        {isImage && url ? (
          <img
            src={url}
            alt={file.name}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex flex-col items-center text-[10px] leading-tight px-1 text-gray-600">
            <span className="text-xl">📄</span>
            <span className="truncate max-w-[56px]">{extOf(file.name)}</span>
          </div>
        )}
      </div>

      {typeof onRemove === "function" && (
        <button
          type="button"
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border shadow hidden group-hover:block"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(file);
          }}
          aria-label={`Remover ${file.name}`}
          title="Remover"
        >
          ×
        </button>
      )}
    </div>
  );
}

function extOf(name = "") {
  const idx = name.lastIndexOf(".");
  if (idx === -1) return "arquivo";
  return name.slice(idx + 1).toLowerCase();
}
