const { z } = require('zod');
const { isValidCNPJ, isValidCEP, isValidUF, isValidBRPhone } = require('./br.cjs');

const orgSchema = z.object({
  name: z.string().min(1, 'nome obrigatorio'),
  cnpj: z.string().refine(isValidCNPJ, 'CNPJ inválido'),
  cep: z.string().refine(isValidCEP, 'CEP inválido'),
  uf: z.string().refine(isValidUF, 'UF inválida'),
  phone: z.string().refine(isValidBRPhone, 'Telefone inválido'),
});

module.exports = { orgSchema };
