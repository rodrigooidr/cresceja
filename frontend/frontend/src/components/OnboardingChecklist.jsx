import React, { useEffect, useState } from 'react';
import { authFetch } from '../services/session.js';

const STEPS = [
  { key: 'connect-whatsapp', label: 'Conectar WhatsApp' },
  { key: 'connect-instagram', label: 'Conectar Instagram' },
  { key: 'create-first-post', label: 'Criar primeiro post' },
  { key: 'setup-automatic-reply', label: 'Ativar resposta automática' },
  { key: 'create-first-appointment', label: 'Criar primeiro agendamento' }
];

function OnboardingChecklist() {
  const [completed, setCompleted] = useState([]);

  useEffect(() => {
    authFetch('/api/onboarding/progress')
      .then(res => res.json())
      .then(data => {
        setCompleted(data.map(d => d.step));
      });
  }, []);

  const markAsDone = async (stepKey) => {
    await authFetch('/api/onboarding/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ step: stepKey })
    });
    setCompleted(prev => [...prev, stepKey]);
  };

  return (
    <div className="bg-white p-4 border rounded space-y-4">
      <h3 className="text-lg font-bold">🎯 Checklist de Início Rápido</h3>
      <ul className="space-y-2">
        {STEPS.map(step => (
          <li key={step.key} className="flex items-center justify-between">
            <span>{completed.includes(step.key) ? '✅' : '⬜️'} {step.label}</span>
            {!completed.includes(step.key) && (
              <button
                className="text-sm text-blue-600 underline"
                onClick={() => markAsDone(step.key)}
              >
                Marcar como concluído
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default OnboardingChecklist;