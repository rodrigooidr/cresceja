import db from '../../db/index.js';

export const cfg = {
  DIR_IN: 'inbound',
  DIR_OUT: 'outbound',
  SENDER_IN: 'contact',
  SENDER_OUT: 'agent',
};

let loaded = false;

export async function ensureLoaded() {
  if (loaded) return cfg;
  try {
    const dr = await db.query(
      `SELECT lower(pg_get_constraintdef(oid)) AS def
         FROM pg_constraint
        WHERE conrelid='public.messages'::regclass
          AND contype='c'
          AND conname='messages_direction_check'
        LIMIT 1`
    );
    const ddef = dr.rows[0]?.def || '';
    if (ddef.includes("'in'") && ddef.includes("'out'")) {
      cfg.DIR_IN = 'in';
      cfg.DIR_OUT = 'out';
    } else if (ddef.includes('incoming') && ddef.includes('outgoing')) {
      cfg.DIR_IN = 'incoming';
      cfg.DIR_OUT = 'outgoing';
    } else {
      cfg.DIR_IN = 'inbound';
      cfg.DIR_OUT = 'outbound';
    }

    const sr = await db.query(
      `SELECT lower(pg_get_constraintdef(oid)) AS def
         FROM pg_constraint
        WHERE conrelid='public.messages'::regclass
          AND contype='c'
          AND conname='messages_sender_check'
        LIMIT 1`
    );
    const sdef = sr.rows[0]?.def || '';
    const inboundOpts = ['them', 'contact', 'customer', 'user', 'external', 'remote'];
    const outboundOpts = ['me', 'agent', 'operator', 'staff', 'system', 'internal'];
    cfg.SENDER_IN = inboundOpts.find((v) => sdef.includes(`'${v}'`)) || cfg.SENDER_IN;
    cfg.SENDER_OUT = outboundOpts.find((v) => sdef.includes(`'${v}'`)) || cfg.SENDER_OUT;

    cfg.DIR_IN = process.env.INBOX_DIR_IN || cfg.DIR_IN;
    cfg.DIR_OUT = process.env.INBOX_DIR_OUT || cfg.DIR_OUT;
    cfg.SENDER_IN = process.env.INBOX_SENDER_IN || cfg.SENDER_IN;
    cfg.SENDER_OUT = process.env.INBOX_SENDER_OUT || cfg.SENDER_OUT;
  } catch (_err) {
    // keep safe defaults
  } finally {
    loaded = true;
  }
  return cfg;
}

export default { ensureLoaded, cfg };
