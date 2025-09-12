const { z } = require('zod');
const { isValidCPF, isValidCEP, isValidUF, isValidBRPhone } = require('./br.cjs');

const clientSchema = z.object({
  name: z.string().min(1, 'nome obrigatorio'),
  email: z.string().email('email inválido').optional(),
  phone: z.string().refine(isValidBRPhone, 'telefone inválido').optional(),
  cpf: z.string().refine(isValidCPF, 'CPF inválido').optional(),
  birthdate: z
    .string()
    .optional()
    .refine((v) => !v || new Date(v) <= new Date(), 'Data de nascimento inválida'),
}).refine((data) => data.email || data.phone, {
  message: 'Telefone ou e-mail obrigatório',
  path: ['phone'],
});

module.exports = { clientSchema };

