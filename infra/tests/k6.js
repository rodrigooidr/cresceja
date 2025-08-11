
import http from 'k6/http';
import { sleep } from 'k6';
export let options = { vus: 20, duration: '1m' };
export default function () {
  http.get('http://localhost:4000/healthz');
  sleep(1);
}
