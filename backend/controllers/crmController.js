// controllers/crmController.js

export function list(req, res) {
  return res.json([]);
}

export function get(req, res) {
  return res.json({});
}

export function create(req, res) {
  return res.status(201).json({ ok: true });
}

export function update(req, res) {
  return res.json({ ok: true });
}

export function remove(req, res) {
  return res.status(204).end();
}
