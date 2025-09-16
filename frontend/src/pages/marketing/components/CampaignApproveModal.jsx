import React from 'react';
import { suggestionTitle } from '../lib/suggestionTitle';

export default function CampaignApproveModal({ open, onClose, jobs = [] }) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/40 flex items-center justify-center">
      <div className="bg-white p-4 rounded shadow max-w-lg w-full">
        <h2 className="text-lg font-semibold mb-2">Aprovar sugestões</h2>
        <div>
          {(Array.isArray(jobs) ? jobs : []).map((job, i) => (
            <div key={job.id || i} className="py-2 border-b last:border-0">
              <div className="font-medium">{suggestionTitle(job, i)}</div>
              {job?.caption && <div className="text-sm opacity-80">{job.caption}</div>}
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button className="border px-3 py-1" onClick={onClose}>Fechar</button>
          <button className="border px-3 py-1">Aprovar tudo</button>
        </div>
      </div>
    </div>
  );
}
