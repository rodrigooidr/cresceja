const { z } = require("zod");
const br = require("./br.cjs");

// Schema legado simples ainda utilizado em alguns pontos
const orgSchema = z.object({
  name: z.string().min(1, "nome obrigatorio"),
  cnpj: z.string().refine(br.isValidCNPJ, "CNPJ inválido"),
  cep: z.string().refine(br.isValidCEP, "CEP inválido"),
  uf: z.string().refine(br.isValidUF, "UF inválida"),
  phone: z.string().refine(br.isValidBRPhone, "Telefone inválido"),
});

// Novo schema completo para criação de organizações
const OrgCreateSchema = z
  .object({
    cnpj: z.string().refine(br.isValidCNPJ, "CNPJ inválido"),
    razao_social: z.string().min(2),
    nome_fantasia: z.string().trim().optional().nullable(),
    ie: z.string().trim().optional().nullable(),
    ie_isento: z.boolean().default(false),
    site: z.string().url().optional().nullable(),
    email: z.string().email().optional().nullable(),
    phone_e164: z
      .string()
      .optional()
      .nullable()
      .refine((v) => !v || br.isValidBRPhone(v), "Telefone inválido"),
    status: z.enum(["active", "suspended", "canceled"]).default("active"),

    endereco: z.object({
      cep: z.string().refine(br.isValidCEP, "CEP inválido"),
      logradouro: z.string().min(2),
      numero: z.string().min(1),
      complemento: z.string().optional().nullable(),
      bairro: z.string().min(2),
      cidade: z.string().min(2),
      uf: z.string().refine(br.isValidUF, "UF inválida"),
      country: z.string().min(2).default("BR"),
    }),

    responsavel: z
      .object({
        nome: z.string().min(2),
        cpf: z
          .string()
          .optional()
          .nullable()
          .refine((v) => !v || br.isValidCPF(v), "CPF inválido"),
        email: z.string().email().optional().nullable(),
        phone_e164: z
          .string()
          .optional()
          .nullable()
          .refine((v) => !v || br.isValidBRPhone(v), "Telefone inválido"),
      })
      .refine((v) => v.email || v.phone_e164, {
        message: "Responsável: informe e-mail ou telefone",
      }),

    plano: z
      .object({
        plan_id: z.string().uuid().optional().nullable(),
        period: z.enum(["monthly", "yearly"]).optional().nullable(),
        trial_start: z.string().datetime().optional().nullable(),
        trial_end: z.string().datetime().optional().nullable(),
      })
      .optional(),
  })
  .refine((v) => v.email || v.phone_e164, {
    message: "Informe e-mail ou telefone da empresa",
  });

module.exports = { orgSchema, OrgCreateSchema };

