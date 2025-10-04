import React from "react";

export default function FilterBar({ children }) {
  return (
    <fieldset className="border p-4 rounded mb-4">
      <legend className="px-1 text-sm font-medium">Filtros</legend>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {children}
      </div>
    </fieldset>
  );
}
