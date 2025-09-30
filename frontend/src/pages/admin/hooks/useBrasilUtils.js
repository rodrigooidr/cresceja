import inboxApi from '@/api/inboxApi';

export function useBrasilUtils({ setValue }) {
  async function lookupCep(event) {
    const raw = (event?.target?.value ?? event)?.toString().replace(/\D/g, '');
    if (!raw || raw.length < 8) return;
    try {
      const { data } = await inboxApi.get(`/api/utils/cep/${raw}`);
      if (data?.city) setValue('city', data.city || '');
      if (data?.state) setValue('state', data.state || '');
      if (data?.neighborhood) setValue('neighborhood', data.neighborhood || '');
      if (data?.street) setValue('street', data.street || '');
      setValue('cep', raw);
    } catch (err) {
      console.warn('lookupCep failed', err);
    }
  }

  async function lookupCnpj(event) {
    const raw = (event?.target?.value ?? event)?.toString().replace(/\D/g, '');
    if (!raw || raw.length < 14) return;
    try {
      const { data } = await inboxApi.get(`/api/utils/cnpj/${raw}`);
      if (data?.name) setValue('name', data.name);
      if (data?.email) setValue('email', data.email);
      if (data?.phone) setValue('phone', data.phone);
      const addr = data?.address || {};
      if (addr.cep) setValue('cep', addr.cep.replace(/\D/g, '').slice(0, 8));
      if (addr.state) setValue('state', addr.state);
      if (addr.city) setValue('city', addr.city);
      if (addr.neighborhood) setValue('neighborhood', addr.neighborhood);
      if (addr.street) setValue('street', addr.street);
      if (addr.number) setValue('number', String(addr.number));
      if (addr.complement) setValue('complement', addr.complement);
    } catch (err) {
      console.warn('lookupCnpj failed', err);
    }
  }

  return { lookupCep, lookupCnpj };
}
