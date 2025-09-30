import React from 'react';

export default function AdminHeaderActions({
  onNew,
  onDuplicate,
  onSave,
  onDelete,
  saving,
  labels = {},
}) {
  const {
    new: newLabel = 'Novo',
    duplicate: duplicateLabel = 'Duplicar',
    save: saveLabel = 'Salvar',
    delete: deleteLabel = 'Excluir',
    saving: savingLabel = 'Salvando…',
  } = labels;

  return (
    <>
      {typeof onNew === 'function' ? (
        <button type="button" onClick={onNew} className="btn btn-light">
          {newLabel}
        </button>
      ) : null}
      {typeof onDuplicate === 'function' ? (
        <button type="button" onClick={onDuplicate} className="btn btn-light">
          {duplicateLabel}
        </button>
      ) : null}
      {typeof onSave === 'function' ? (
        <button type="button" onClick={onSave} className="btn btn-primary" disabled={!!saving}>
          {saving ? savingLabel : saveLabel}
        </button>
      ) : null}
      {typeof onDelete === 'function' ? (
        <button type="button" onClick={onDelete} className="btn btn-danger">
          {deleteLabel}
        </button>
      ) : null}
    </>
  );
}
