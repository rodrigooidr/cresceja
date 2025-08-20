export async function createSubscription({ orgId, planId }) {
  return { id: `mp-${orgId}-${planId}` };
}

export async function cancelSubscription(externalId) {
  return { canceled: true, id: externalId };
}

export default { createSubscription, cancelSubscription };
