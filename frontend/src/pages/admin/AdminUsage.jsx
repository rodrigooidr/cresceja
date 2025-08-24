import React from "react";
export default function AdminUsage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin • Regras de Uso</h1>
      <p className="text-gray-700">Configure regras automáticas de consumo por plano (aplicadas no backend):</p>
      <ul className="list-disc ml-6 text-sm text-gray-700">
        <li>Reset de cotas no ciclo (mensal) após confirmação de pagamento.</li>
        <li>Bloqueio ou redução de funcionalidades quando créditos acabam.</li>
        <li>Envio de avisos por e-mail/WhatsApp com thresholds (ex: 80% e 100%).</li>
      </ul>
      <div className="p-4 bg-yellow-50 border rounded-xl text-sm">
        Observação: esta tela é informativa. A lógica deve estar no backend (expondo endpoints para leitura e update).
      </div>
    </div>
  );
}
