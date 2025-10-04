import React, { useId, useMemo, useState } from "react";

export default function ChannelPicker({ value, onChange, options = [] }) {
  const [open, setOpen] = useState(false);
  const baseId = useId();
  const listId = `${baseId}-listbox`;
  const labelId = `${baseId}-label`;

  const selected = useMemo(
    () => options.find(o => String(o.value) === String(value)) || null,
    [options, value]
  );

  return (
    <div>
      <label id={labelId} htmlFor={`${baseId}-input`}>Canal</label>
      <input
        id={`${baseId}-input`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={labelId}
        data-testid="channel-combobox"
        value={selected?.label || ""}
        onChange={() => {}}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        readOnly
      />
      {open && (
        <ul id={listId} role="listbox" data-testid="channel-listbox" style={{ marginTop: 4, border: "1px solid #ccc", padding: 0 }}>
          {options.map(opt => (
            <li
              key={opt.value}
              role="option"
              aria-selected={String(opt.value) === String(value)}
              data-testid={`channel-option-${opt.value}`}
              onClick={() => { onChange?.(opt.value); setOpen(false); }}
              style={{ listStyle: "none", padding: "2px 4px", cursor: "pointer", background: String(opt.value) === String(value) ? "#bde4ff" : "white" }}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

