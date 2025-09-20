
import fs from 'fs';
import path from 'path';

async function getOpenAI() {
  const { default: OpenAI } = await import('openai');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function transcribeAudio(filePath, { model = 'gpt-4o-transcribe' } = {}) {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY not set, skipping transcription.');
    return null;
  }

  try {
    const openai = await getOpenAI();
    const stream = fs.createReadStream(path.resolve(filePath));
    const resp = await openai.audio.transcriptions.create({
      file: stream,
      model,
    });

    return resp?.text ?? resp;
  } catch (err) {
    console.error('Transcription error', err?.response?.data || err.message);
    return null;
  }
}

export default { transcribeAudio };
