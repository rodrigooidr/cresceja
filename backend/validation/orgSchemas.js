import { z } from 'zod';
import { isValidCNPJ, isValidCEP, isValidUF, isValidBRPhone } from './br.js';

export const orgSchema = z.object({
  name: z.string().min(1, 'nome obrigatorio'),
  cnpj: z.string().refine(isValidCNPJ, 'CNPJ inválido'),
  cep: z.string().refine(isValidCEP, 'CEP inválido'),
  uf: z.string().refine(isValidUF, 'UF inválida'),
  phone: z.string().refine(isValidBRPhone, 'Telefone inválido'),
});
