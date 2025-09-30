import React from 'react';

export default function AdminHeaderActions({ onNew, onDuplicate, onSave, onDelete, saving }) {
  return (
    <>
      <button type="button" onClick={onNew} className="btn btn-light">
        Novo
      </button>
      <button type="button" onClick={onDuplicate} className="btn btn-light">
        Duplicar
      </button>
      <button type="button" onClick={onSave} className="btn btn-primary" disabled={!!saving}>
        {saving ? 'Salvando…' : 'Salvar'}
      </button>
      <button type="button" onClick={onDelete} className="btn btn-danger">
        Excluir
      </button>
    </>
  );
}
