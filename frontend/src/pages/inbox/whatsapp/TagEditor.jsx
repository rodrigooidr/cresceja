import React from "react";

export default function TagEditor({ tags = [], onAdd }) {
  const [value, setValue] = React.useState("");

  const stop = React.useCallback((event) => {
    event.stopPropagation();
  }, []);

  const handleKeyDown = React.useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const trimmed = value.trim();
        if (trimmed) {
          onAdd?.(trimmed);
          setValue("");
        }
      }
      event.stopPropagation();
    },
    [onAdd, value]
  );

  return (
    <div className="flex gap-1 items-center" onClick={stop} onMouseDown={stop}>
      <div className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <span key={tag} className="text-[10px] px-1 bg-amber-100 rounded">
            {tag}
          </span>
        ))}
      </div>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        onClick={stop}
        placeholder="adicionar tag"
        className="border px-1 py-0.5 text-[11px]"
        style={{ width: 110 }}
        data-testid="tag-input"
      />
    </div>
  );
}
