import React from "react";
import { fetchLogs } from "../../../lib/audit.js";

export default function DevLogsButton() {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState([]);

  async function load() {
    const data = await fetchLogs({ limit: 50 });
    setItems(data);
    setOpen(true);
  }

  return (
    <>
      <button onClick={load} data-testid="dev-logs" className="border px-2 py-1">
        Ver últimos logs
      </button>
      {open && (
        <div role="dialog" style={{ maxHeight: 300, overflow: "auto" }}>
          <pre>{JSON.stringify(items, null, 2)}</pre>
          <button onClick={() => setOpen(false)} className="border px-2 py-1 mt-2">
            Fechar
          </button>
        </div>
      )}
    </>
  );
}
