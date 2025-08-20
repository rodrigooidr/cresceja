import stripe from './providers/stripe.js';
import mercadopago from './providers/mercadopago.js';
import pagseguro from './providers/pagseguro.js';

const providers = { stripe, mercadopago, pagseguro };

export function getProvider(name = 'stripe') {
  return providers[name] || stripe;
}

export default { getProvider };
