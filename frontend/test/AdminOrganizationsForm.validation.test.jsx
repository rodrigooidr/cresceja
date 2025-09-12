import { orgSchema } from '../src/validation/orgSchemas.js';

describe('orgSchema', () => {
  test('invalid fields', () => {
    expect(() => orgSchema.parse({})).toThrow();
    expect(() => orgSchema.parse({ name: 'Org', cnpj: '00', cep: '1', uf: 'XX', phone: '123' })).toThrow();
  });
  test('valid data', () => {
    expect(() => orgSchema.parse({
      name: 'Org',
      cnpj: '19131243000197',
      cep: '01311000',
      uf: 'SP',
      phone: '+5511987654321'
    })).not.toThrow();
  });
});
