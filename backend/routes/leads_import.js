
import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const router = Router();

router.post('/import-csv', upload.single('file'), async (req, res, next) => {
  const db = req.db;
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  try {
    const csv = req.file.buffer.toString('utf8');
    const records = [];
    await new Promise((resolve, reject) => {
      parse(csv, { columns: true, trim: true })
        .on('data', (r) => records.push(r))
        .on('end', resolve)
        .on('error', reject);
    });
    let ok = 0, dup = 0;
    for (const r of records) {
      const name = r.name || r.nome || 'Sem nome';
      const email = r.email || null;
      const phone = r.phone || r.telefone || null;
      const exists = await db.query(
        `SELECT id FROM leads WHERE (email=$1 AND email IS NOT NULL) OR (phone=$2 AND phone IS NOT NULL)`,
        [email, phone]
      );
      if (exists.rowCount) { dup++; continue; }
      await db.query(
        `INSERT INTO leads (name, email, phone, source_channel, consent) VALUES ($1,$2,$3,'import_csv',TRUE)`,
        [name, email, phone]
      );
      ok++;
    }
    res.json({ imported: ok, duplicates: dup, total: records.length });
  } catch (e) {
    next(e);
  }
});

router.post('/score/recompute', async (req, res, next) => {
  const db = req.db;
  try {
    const leads = (await db.query(`SELECT id, email, phone FROM leads`)).rows;
    for (const l of leads) {
      const msgCount = (await db.query(`SELECT COUNT(*)::int AS c FROM messages WHERE lead_id=$1`, [l.id])).rows[0]?.c || 0;
      const opps = (await db.query(`SELECT COUNT(*)::int AS c FROM crm_opportunities WHERE lead_id=$1`, [l.id])).rows[0]?.c || 0;
      let score = Math.min(100, msgCount) + (l.email ? 10 : 0) + (l.phone ? 10 : 0) + (opps * 20);
      if (score > 100) score = 100;
      await db.query(`UPDATE leads SET score=$1 WHERE id=$2`, [score, l.id]);
    }
    res.json({ ok: true, recomputed: leads.length });
  } catch (e) {
    next(e);
  }
});

export default router;



