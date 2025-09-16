import React from "react";

export default function BulkApprovalBar({ count = 0, running = false, progress, onStart, onCancel, t = {} }) {
  const tt = {
    start: "Aprovar Selecionados",
    cancel: "Cancelar",
    running: "Aprovando",
    ...t,
  };

  if (count <= 0 && !running) return null;

  return (
    <div className="cc-bulkbar" data-testid="bulk-bar">
      <span data-testid="bulk-progress">
        {running
          ? `${tt.running} (${progress?.done ?? 0}/${progress?.total ?? count})…`
          : `${count} selecionado(s)`}
      </span>
      {!running ? (
        <button
          onClick={onStart}
          disabled={count === 0}
          aria-disabled={count === 0}
          data-testid="bulk-start"
        >
          {tt.start}
        </button>
      ) : (
        <button onClick={onCancel} data-testid="bulk-cancel">
          {tt.cancel}
        </button>
      )}
    </div>
  );
}
