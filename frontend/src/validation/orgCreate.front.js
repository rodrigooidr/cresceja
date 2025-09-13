import { z } from 'zod';

const cep = () => z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido');
const uf  = () => z.string().regex(/^[A-Z]{2}$/i, 'UF inválida');
const e164BR = () => z.string().regex(/^\+55\d{10,11}$/, 'Telefone inválido (+55...)');
const cnpj = () => z.string().regex(/^\d{14}$|^\d{2}\.\?\d{3}\.\?\d{3}\/\?\d{4}-?\d{2}$/, 'CNPJ inválido');
const cpf  = () => z.string().regex(/^\d{11}$|^\d{3}\.\?\d{3}\.\?\d{3}-?\d{2}$/, 'CPF inválido');

export const OrgCreateFrontSchema = z.object({
  cnpj: cnpj(),
  razao_social: z.string().min(2),
  nome_fantasia: z.string().trim().optional().nullable(),
  ie: z.string().trim().optional().nullable(),
  ie_isento: z.boolean().optional().default(false),
  site: z.string().url().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone_e164: e164BR().optional().nullable(),
  status: z.enum(['active','suspended','canceled']).default('active'),
  endereco: z.object({
    cep: cep(),
    logradouro: z.string().min(2),
    numero: z.string().min(1),
    complemento: z.string().optional().nullable(),
    bairro: z.string().min(2),
    cidade: z.string().min(2),
    uf: uf(),
    country: z.string().min(2).default('BR'),
  }),
  responsavel: z.object({
    nome: z.string().min(2),
    cpf: cpf().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone_e164: e164BR().optional().nullable(),
  }).refine(v => v.email || v.phone_e164, { message: 'Informe e-mail ou telefone do responsável' }),
}).refine(v => v.email || v.phone_e164, { message: 'Informe e-mail ou telefone da empresa' });

