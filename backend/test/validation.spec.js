import { isValidCPF, isValidCNPJ, isValidCEP, isValidUF, isValidBRPhone } from '../validation/br.js';
import { orgSchema } from '../validation/orgSchemas.js';
import { clientSchema } from '../validation/clientSchemas.js';

describe('br helpers', () => {
  test('cpf', () => {
    expect(isValidCPF('39053344705')).toBe(true);
    expect(isValidCPF('12345678900')).toBe(false);
  });
  test('cnpj', () => {
    expect(isValidCNPJ('19131243000197')).toBe(true);
    expect(isValidCNPJ('00000000000000')).toBe(false);
  });
  test('cep', () => {
    expect(isValidCEP('01311000')).toBe(true);
    expect(isValidCEP('123')).toBe(false);
  });
  test('uf', () => {
    expect(isValidUF('SP')).toBe(true);
    expect(isValidUF('XX')).toBe(false);
  });
  test('phone', () => {
    expect(isValidBRPhone('+5511987654321')).toBe(true);
    expect(isValidBRPhone('11987654321')).toBe(false);
  });
});

describe('schemas', () => {
  test('orgSchema valid', () => {
    expect(() => orgSchema.parse({
      name: 'Org',
      cnpj: '19131243000197',
      cep: '01311000',
      uf: 'SP',
      phone: '+5511987654321'
    })).not.toThrow();
  });
  test('clientSchema requires phone or email', () => {
    expect(() => clientSchema.parse({ name: 'Joao' })).toThrow();
  });
});
