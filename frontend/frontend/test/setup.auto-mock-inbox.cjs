try {
  jest.mock('@/api/inboxApi');
} catch (error) {
  console.warn('Failed to mock inboxApi in setup.auto-mock-inbox.cjs', error);
}
