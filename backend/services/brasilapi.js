import fetch from 'node-fetch';

const onlyDigits = (s = '') => (s || '').toString().replace(/\D+/g, '');

export async function lookupCNPJ(cnpj) {
  const doc = onlyDigits(cnpj);
  if (doc.length !== 14) throw new Error('invalid_cnpj');
  const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${doc}`);
  if (!r.ok) throw new Error('cnpj_lookup_failed');
  const j = await r.json();
  return {
    cnpj: j.cnpj || doc,
    razao_social: j.razao_social || j.nome_fantasia || '',
    nome_fantasia: j.nome_fantasia || '',
    email: j.email || null,
    endereco: {
      cep: onlyDigits(j.cep),
      logradouro: j.logradouro || j.descricao_tipo_de_logradouro || '',
      numero: j.numero || '',
      complemento: j.complemento || '',
      bairro: j.bairro || '',
      cidade: j.municipio || j.cidade || '',
      uf: j.uf || '',
      country: 'BR',
    },
    ie: j.inscr_estadual || null,
    site: j.site || null,
  };
}

export async function lookupCEP(cep) {
  const code = onlyDigits(cep);
  if (code.length !== 8) throw new Error('invalid_cep');
  const r = await fetch(`https://viacep.com.br/ws/${code}/json/`);
  if (!r.ok) throw new Error('cep_lookup_failed');
  const j = await r.json();
  if (j.erro) throw new Error('cep_not_found');
  return {
    cep: code,
    logradouro: j.logradouro || '',
    bairro: j.bairro || '',
    cidade: j.localidade || '',
    uf: j.uf || '',
    country: 'BR',
  };
}
