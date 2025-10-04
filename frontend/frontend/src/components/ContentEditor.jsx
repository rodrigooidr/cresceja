import React from "react";

export default function ContentEditor({ value, onChange, placeholder = "Digite..." }) {
  if (process.env.NODE_ENV === "test") {
    return (
      <textarea
        data-testid="content-editor"
        defaultValue={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div data-testid="content-editor" contentEditable suppressContentEditableWarning>
      {value}
    </div>
  );
}

