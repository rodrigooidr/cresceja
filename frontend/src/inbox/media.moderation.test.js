import { validateFile, detectKind, __testHooks } from './mediaPolicy';

const policy = {
  allowedMime: [
    'image/jpeg','image/png','image/webp','image/gif',
    'video/mp4','audio/mpeg','audio/ogg','audio/wav',
    'application/pdf'
  ],
  maxBytes: { image: 10*1024*1024, video: 16*1024*1024, audio: 16*1024*1024, document: 10*1024*1024 },
  maxImagePx: 4096,
  maxVideoSeconds: 300,
  maxAudioSeconds: 300,
};

function makeFile(name, type, sizeBytes) {
  const data = new Uint8Array(sizeBytes || 1);
  return new File([data], name, { type });
}

afterEach(() => { __testHooks.reset(); });

test('detectKind returns expected kinds', () => {
  expect(detectKind('image/jpeg')).toBe('image');
  expect(detectKind('video/mp4')).toBe('video');
  expect(detectKind('audio/mpeg')).toBe('audio');
  expect(detectKind('application/pdf')).toBe('document');
  expect(detectKind('application/zip')).toBe('unknown');
});

test('accepts small allowed image', async () => {
  const f = makeFile('x.jpg', 'image/jpeg', 1000);
  const r = await validateFile(f, policy);
  expect(r.ok).toBe(true);
  expect(r.previewUrl || null).not.toBeNull();
});

test('rejects mime not allowed', async () => {
  const f = makeFile('x.zip', 'application/zip', 1000);
  const r = await validateFile(f, policy);
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('mime-not-allowed');
});

test('rejects file too large by size', async () => {
  const f = makeFile('a.mp3', 'audio/mpeg', policy.maxBytes.audio + 1);
  const r = await validateFile(f, policy);
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('file-too-large');
});

test('downscales large image (test path via hook)', async () => {
  __testHooks.setResolvers({ image: () => ({ width: 5000, height: 3000, fake: true }) });
  const f = makeFile('big.jpg', 'image/jpeg', 1024);
  const r = await validateFile(f, policy);
  expect(r.ok).toBe(true);
  // In test mode we mark a transformed file (clone) to prove the path ran
  expect(!!r.transformedFile).toBe(true);
});

test('rejects long video via duration', async () => {
  __testHooks.setResolvers({ media: () => ({ duration: 999 }) });
  const f = makeFile('v.mp4', 'video/mp4', 1024);
  const r = await validateFile(f, policy);
  expect(r.ok).toBe(false);
  expect(r.reason).toBe('duration-too-long');
});
