let lastQR = null;
let status = 'idle';

export function setQR(data) {
  lastQR = data;
  status = 'pending';
}

export function clearQR() {
  lastQR = null;
}

export function getQR() {
  return lastQR;
}

export function setStatus(value) {
  status = value;
}

export function getStatus() {
  return status;
}

export default {
  setQR,
  clearQR,
  getQR,
  setStatus,
  getStatus,
};
