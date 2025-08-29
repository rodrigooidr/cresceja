// Limite padrão: 15 MB
export const MAX_UPLOAD_MB = 15;

// Prefixos permitidos (bem flexível, cobre imagens, vídeos, áudios e PDF)
export const ALLOWED_MIME_PREFIXES = [
  'image/', 'video/', 'audio/', 'application/pdf'
];

export function isAllowed(file) {
  if (!file || !file.type) return false;
  return ALLOWED_MIME_PREFIXES.some((p) => file.type.startsWith(p));
}

export function exceedsSize(file, maxMb = MAX_UPLOAD_MB) {
  if (!file || typeof file.size !== 'number') return true;
  return file.size > maxMb * 1024 * 1024;
}

// Mensagem amigável para toasts
export function violationMessage(file) {
  if (exceedsSize(file)) return `Arquivo “${file.name}” excede ${MAX_UPLOAD_MB}MB.`;
  if (!isAllowed(file)) return `Tipo não permitido: ${file.type || 'desconhecido'}.`;
  return '';
}
