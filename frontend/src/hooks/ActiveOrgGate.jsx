// frontend/src/hooks/ActiveOrgGate.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import useActiveOrgGate from "./useActiveOrgGate";

export default function ActiveOrgGate() {
  const { allowed, hasOrg } = useActiveOrgGate({
    minRole: 'Agent',
    mode: "silent",
  });

  if (!allowed) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold mb-2">Acesso não permitido</h2>
        <p className="text-gray-600">Você não possui permissão para acessar esta área.</p>
      </div>
    );
  }

  if (!hasOrg) {
    return (
      <div className="p-8">
        <h2 className="text-xl font-semibold mb-2">Selecione uma organização</h2>
        <p className="text-gray-600">
          Use o seletor no lado esquerdo para escolher o cliente/empresa que deseja acessar.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
