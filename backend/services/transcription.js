
import fs from 'fs';
async function transcribeAudio(filePath){
  if(!process.env.OPENAI_API_KEY){
    console.warn('OPENAI_API_KEY not set, skipping transcription.');
    return null;
  }
  try{
    import OpenAI from 'openai';
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const stream = fs.createReadStream(filePath);
    const resp = await openai.audio.transcriptions.create({
      file: stream,
      model: 'whisper-1',
      response_format: 'verbose_json'
    });
    return resp;
  }catch(err){
    console.error('Transcription error', err?.response?.data || err.message);
    return null;
  }
}
export default { transcribeAudio };
