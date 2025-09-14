import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { DateTime } from 'luxon';
import { useApi } from '../../../contexts/useApi.js';
import useActiveOrg from '../../../hooks/useActiveOrg.js';
import useToastFallback from '../../../hooks/useToastFallback.js';

const schema = z.object({
  title: z.string().min(1),
  monthRef: z.string().or(z.date()),
  defaultTargets: z.object({ ig: z.boolean(), fb: z.boolean() }),
  frequency: z.coerce.number().min(1).max(31).default(30),
  profile: z.object({ segmento: z.string().optional(), tom: z.string().optional(), produtos: z.array(z.string()).optional() }).optional(),
  blacklistDates: z.array(z.string()).optional(),
  timeWindows: z.array(z.object({ start: z.string(), end: z.string() })).optional(),
  timezone: z.string().default('America/Sao_Paulo')
});

export default function CampaignGenerateModal({ onClose, onGenerated }) {
  const { activeOrg } = useActiveOrg();
  const api = useApi();
  const toast = useToastFallback();
  const { register, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      monthRef: new Date().toISOString().slice(0,10),
      defaultTargets: { ig: true, fb: false },
      frequency: 30,
      timezone: 'America/Sao_Paulo'
    }
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const body = { ...values, monthRef: DateTime.fromISO(String(values.monthRef)).startOf('month').toISODate() };
      await api.post(`/orgs/${activeOrg}/campaigns/generate`, body);
      toast({ title: 'Campanha gerada' });
      onGenerated?.();
      onClose();
    } catch (e) {
      toast({ title: 'Falha ao gerar', status: 'error' });
    }
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-white p-4 space-y-2 w-80">
        <h2 className="text-lg font-bold">Gerar Campanha (IA)</h2>
        <form onSubmit={onSubmit} className="space-y-2">
          <input {...register('title')} placeholder="Título" className="border p-2 w-full" />
          <div className="flex gap-2">
            <label><input type="checkbox" {...register('defaultTargets.ig')} /> IG</label>
            <label><input type="checkbox" {...register('defaultTargets.fb')} /> FB</label>
          </div>
          <input type="number" {...register('frequency', { valueAsNumber: true })} className="border p-2 w-full" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="btn">Cancelar</button>
            <button type="submit" className="btn btn-primary">Gerar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
