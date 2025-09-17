export async function run({ prompt, tools = [] }) {
  return {
    output: 'OK (mock)',
    toolCalls: [],
    tokens: 123,
    confidence: 0.85,
  };
}
