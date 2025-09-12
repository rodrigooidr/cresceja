import { clientSchema } from '../src/validation/clientSchemas.js';

describe('clientSchema', () => {
  test('requires name and contact', () => {
    expect(() => clientSchema.parse({})).toThrow();
    expect(() => clientSchema.parse({ name: 'Ana' })).toThrow();
  });
  test('valid data', () => {
    expect(() => clientSchema.parse({
      name: 'Ana',
      phone: '+5511987654321',
      birthdate: '2000-01-01'
    })).not.toThrow();
  });
  test('birthdate not future', () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const iso = future.toISOString().slice(0,10);
    expect(() => clientSchema.parse({ name: 'Ana', phone: '+5511987654321', birthdate: iso })).toThrow();
  });
});
