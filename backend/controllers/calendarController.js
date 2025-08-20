// Uses per-request client from withOrg middleware

export async function listCalendars(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const totalRes = await req.db.query(
      'SELECT COUNT(*) FROM calendars WHERE org_id = $1 AND kind = $2',
      [req.orgId, 'content']
    );
    const total = Number(totalRes.rows[0]?.count || 0);

    const { rows } = await req.db.query(
      `SELECT id, name, color, kind, created_at
         FROM calendars
        WHERE org_id = $1 AND kind = $2
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4`,
      [req.orgId, 'content', limit, offset]
    );

    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

export async function createCalendar(req, res, next) {
  try {
    const { name, color } = req.body || {};
    const { rows } = await req.db.query(
      `INSERT INTO calendars (org_id, name, color, kind)
       VALUES ($1, $2, $3, 'content')
       RETURNING id, name, color, kind, created_at`,
      [req.orgId, name, color || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function listEvents(req, res, next) {
  try {
    const { calendarId } = req.params;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const totalRes = await req.db.query(
      'SELECT COUNT(*) FROM calendar_events WHERE calendar_id = $1 AND org_id = $2',
      [calendarId, req.orgId]
    );
    const total = Number(totalRes.rows[0]?.count || 0);

    const { rows } = await req.db.query(
      `SELECT ce.id, ce.post_id, ce.scheduled_at, ce.status,
              p.title, p.channels, a.url AS preview_url
         FROM calendar_events ce
         JOIN posts p ON p.id = ce.post_id
         LEFT JOIN assets a ON p.preview_asset = a.id
        WHERE ce.calendar_id = $1 AND ce.org_id = $2
        ORDER BY ce.scheduled_at ASC
        LIMIT $3 OFFSET $4`,
      [calendarId, req.orgId, limit, offset]
    );

    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

export async function createEvent(req, res, next) {
  try {
    const { calendarId } = req.params;
    const { postId, scheduledAt } = req.body || {};
    const { rows } = await req.db.query(
      `INSERT INTO calendar_events (org_id, calendar_id, post_id, scheduled_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, post_id, scheduled_at, status`,
      [req.orgId, calendarId, postId, scheduledAt]
    );
    await req.db.query('UPDATE posts SET status = $1 WHERE id = $2 AND org_id = $3', [
      'scheduled',
      postId,
      req.orgId,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const { calendarId, id } = req.params;
    const { scheduledAt } = req.body || {};
    const { rows } = await req.db.query(
      `UPDATE calendar_events
          SET scheduled_at = COALESCE($1, scheduled_at),
              updated_at = NOW()
        WHERE id = $2 AND calendar_id = $3 AND org_id = $4
        RETURNING id, post_id, scheduled_at, status`,
      [scheduledAt, id, calendarId, req.orgId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'not_found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

export async function removeEvent(req, res, next) {
  try {
    const { calendarId, id } = req.params;
    await req.db.query(
      'DELETE FROM calendar_events WHERE id = $1 AND calendar_id = $2 AND org_id = $3',
      [id, calendarId, req.orgId]
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
