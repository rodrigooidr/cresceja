import React from 'react';
import { suggestionTitle } from '../lib/suggestionTitle.js';

export default function CampaignApproveModal({ jobs = [], onClose, onApprove }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-4 w-[520px] max-w-[95vw] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Aprovar Sugestões</h3>
          {onClose && (
            <button onClick={onClose} className="text-sm underline">
              Fechar
            </button>
          )}
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {jobs.length === 0 ? (
            <div className="text-sm opacity-70">Nenhuma sugestão disponível.</div>
          ) : (
            jobs.map((job, i) => {
              const title = suggestionTitle(job, i);
              return (
                <div key={job?.id ?? job?.uuid ?? i} className="border rounded p-3 space-y-1">
                  <div className="font-medium">{title}</div>
                  {job?.caption && (
                    <div className="text-sm opacity-80 whitespace-pre-wrap">{job.caption}</div>
                  )}
                  {job?.text && !job?.caption && (
                    <div className="text-sm opacity-80 whitespace-pre-wrap">{job.text}</div>
                  )}
                  {job?.status && (
                    <div className="text-xs uppercase opacity-60">Status: {job.status}</div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2">
          {onClose && (
            <button onClick={onClose} className="px-3 py-1 text-sm underline">
              Cancelar
            </button>
          )}
          {onApprove && (
            <button onClick={() => onApprove(jobs)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded">
              Aprovar selecionadas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
