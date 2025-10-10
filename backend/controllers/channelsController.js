import qrcode from 'qrcode';

// Import compatível com CJS/ESM e com versões que exportam default ou nomeado
const baileys = require('@whiskeysockets/baileys');

const makeWASocket =
  (baileys && (baileys.default || baileys.makeWASocket)) ||
  (() => {
    throw new Error('Baileys: makeWASocket export not found');
  });

const { useMultiFileAuthState } = baileys;

// List channels
export async function list(req, res) {
  const { rows } = await req.db.query(
    'SELECT * FROM channels WHERE org_id = $1 ORDER BY created_at DESC',
    [req.orgId]
  );
  res.json({ data: rows });
}

// Create channel
export async function create(req, res) {
  const { type, name, config = {} } = req.body || {};
  if (!type) return res.status(400).json({ error: 'type_required' });
  const { rows } = await req.db.query(
    'INSERT INTO channels (org_id, type, name, config) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.orgId, type, name || type, config]
  );
  res.status(201).json({ data: rows[0] });
}

// Update channel
export async function update(req, res) {
  const { id } = req.params;
  const { name, config, secrets } = req.body || {};
  const { rows } = await req.db.query(
    `UPDATE channels SET name=COALESCE($1,name), config=COALESCE($2,config), secrets=COALESCE($3,secrets), updated_at=NOW()
       WHERE id=$4 AND org_id=$5 RETURNING *`,
    [name, config, secrets, id, req.orgId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not_found' });
  res.json({ data: rows[0] });
}

// Delete channel
export async function remove(req, res) {
  const { id } = req.params;
  await req.db.query('DELETE FROM channels WHERE id = $1 AND org_id = $2', [id, req.orgId]);
  res.json({ data: { success: true } });
}

// Start Baileys session and return QR code
export async function baileysSession(req, res) {
  const { channelId } = req.body || {};
  if (!channelId) return res.status(400).json({ error: 'channel_required' });
  const { rows } = await req.db.query(
    'SELECT * FROM channels WHERE id=$1 AND org_id=$2',
    [channelId, req.orgId]
  );
  const ch = rows[0];
  if (!ch || ch.type !== 'whatsapp_baileys') return res.status(404).json({ error: 'not_found' });

  const { state, saveCreds } = await useMultiFileAuthState(`baileys_${ch.id}`);
  const sock = makeWASocket({ auth: state, printQRInTerminal: false });

  let responded = false;
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { qr, connection } = update;
    if (qr && !responded) {
      responded = true;
      const dataUrl = await qrcode.toDataURL(qr);
      res.json({ data: { qr: dataUrl } });
    }
    if (connection === 'open') {
      const creds = JSON.stringify(state.creds);
      await req.db.query(
        `UPDATE channels SET secrets = jsonb_set(COALESCE(secrets, '{}'::jsonb), '{creds}', $1::jsonb) WHERE id=$2 AND org_id=$3`,
        [creds, ch.id, req.orgId]
      );
    }
  });
}
