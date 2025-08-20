// Activities controller: calendars, members and meeting events

export async function listCalendars(req, res, next) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const totalRes = await req.db.query(
      `SELECT COUNT(*) FROM calendars c
         JOIN calendar_members m ON m.calendar_id = c.id AND m.user_id = $1
        WHERE c.org_id = $2 AND c.kind = 'activity'`,
      [req.user.id, req.orgId]
    );
    const total = Number(totalRes.rows[0]?.count || 0);

    const { rows } = await req.db.query(
      `SELECT c.id, c.name, c.color, c.kind, c.created_at
         FROM calendars c
         JOIN calendar_members m ON m.calendar_id = c.id AND m.user_id = $1
        WHERE c.org_id = $2 AND c.kind = 'activity'
        ORDER BY c.created_at DESC
        LIMIT $3 OFFSET $4`,
      [req.user.id, req.orgId, limit, offset]
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
       VALUES ($1, $2, $3, 'activity')
       RETURNING id, name, color, kind, created_at`,
      [req.orgId, name, color || null]
    );
    const cal = rows[0];
    await req.db.query(
      `INSERT INTO calendar_members (org_id, calendar_id, user_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.orgId, cal.id, req.user.id]
    );
    res.status(201).json(cal);
  } catch (err) {
    next(err);
  }
}

export async function removeCalendar(req, res, next) {
  try {
    const { calendarId } = req.params;
    const { rowCount } = await req.db.query(
      `DELETE FROM calendars
        WHERE id = $1 AND org_id = $2
          AND EXISTS (
            SELECT 1 FROM calendar_members
             WHERE calendar_id = $1 AND user_id = $3
          )`,
      [calendarId, req.orgId, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'not_found' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function ensureMembership(db, calendarId, userId) {
  const { rowCount } = await db.query(
    'SELECT 1 FROM calendar_members WHERE calendar_id = $1 AND user_id = $2',
    [calendarId, userId]
  );
  return rowCount > 0;
}

export async function listMembers(req, res, next) {
  try {
    const { calendarId } = req.params;
    if (!(await ensureMembership(req.db, calendarId, req.user.id))) {
      return res.status(404).json({ error: 'not_found' });
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const totalRes = await req.db.query(
      'SELECT COUNT(*) FROM calendar_members WHERE calendar_id = $1 AND org_id = $2',
      [calendarId, req.orgId]
    );
    const total = Number(totalRes.rows[0]?.count || 0);

    const { rows } = await req.db.query(
      `SELECT user_id, created_at
         FROM calendar_members
        WHERE calendar_id = $1 AND org_id = $2
        ORDER BY created_at ASC
        LIMIT $3 OFFSET $4`,
      [calendarId, req.orgId, limit, offset]
    );

    res.json({ data: rows, meta: { page, limit, total } });
  } catch (err) {
    next(err);
  }
}

export async function addMember(req, res, next) {
  try {
    const { calendarId } = req.params;
    const { userId } = req.body || {};
    if (!(await ensureMembership(req.db, calendarId, req.user.id))) {
      return res.status(404).json({ error: 'not_found' });
    }
    await req.db.query(
      `INSERT INTO calendar_members (org_id, calendar_id, user_id)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.orgId, calendarId, userId]
    );
    res.status(201).json({ calendarId, userId });
  } catch (err) {
    next(err);
  }
}

export async function removeMember(req, res, next) {
  try {
    const { calendarId, userId } = req.params;
    if (!(await ensureMembership(req.db, calendarId, req.user.id))) {
      return res.status(404).json({ error: 'not_found' });
    }
    await req.db.query(
      `DELETE FROM calendar_members WHERE calendar_id = $1 AND user_id = $2 AND org_id = $3`,
      [calendarId, userId, req.orgId]
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function listEvents(req, res, next) {
  try {
    const { calendarId } = req.params;
    if (!(await ensureMembership(req.db, calendarId, req.user.id))) {
      return res.status(404).json({ error: 'not_found' });
    }
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 20, 1);
    const offset = (page - 1) * limit;

    const totalRes = await req.db.query(
      `SELECT COUNT(*) FROM calendar_events
        WHERE calendar_id = $1 AND org_id = $2 AND type = 'meeting'`,
      [calendarId, req.orgId]
    );
    const total = Number(totalRes.rows[0]?.count || 0);

    const { rows } = await req.db.query(
      `SELECT id, title, client_name, start_at, end_at, attendee_id
         FROM calendar_events
        WHERE calendar_id = $1 AND org_id = $2 AND type = 'meeting'
        ORDER BY start_at ASC
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
    if (!(await ensureMembership(req.db, calendarId, req.user.id))) {
      return res.status(404).json({ error: 'not_found' });
    }
    const { title, clientName, startAt, endAt, attendeeId } = req.body || {};
    const params = [
      req.orgId,
      calendarId,
      title,
      clientName || null,
      startAt,
      endAt,
      attendeeId || null,
    ];
    try {
      const { rows } = await req.db.query(
        `INSERT INTO calendar_events (org_id, calendar_id, type, title, client_name, start_at, end_at, attendee_id)
         VALUES ($1, $2, 'meeting', $3, $4, $5, $6, $7)
         RETURNING id, title, client_name, start_at, end_at, attendee_id`,
        params
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.message && e.message.includes('conflict')) {
        return res.status(409).json({ error: 'conflict' });
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const { calendarId, id } = req.params;
    if (!(await ensureMembership(req.db, calendarId, req.user.id))) {
      return res.status(404).json({ error: 'not_found' });
    }
    const { title, clientName, startAt, endAt, attendeeId } = req.body || {};
    try {
      const { rows } = await req.db.query(
        `UPDATE calendar_events
            SET title = COALESCE($1, title),
                client_name = COALESCE($2, client_name),
                start_at = COALESCE($3, start_at),
                end_at = COALESCE($4, end_at),
                attendee_id = COALESCE($5, attendee_id),
                updated_at = NOW()
          WHERE id = $6 AND calendar_id = $7 AND org_id = $8 AND type = 'meeting'
          RETURNING id, title, client_name, start_at, end_at, attendee_id`,
        [title, clientName, startAt, endAt, attendeeId, id, calendarId, req.orgId]
      );
      if (!rows[0]) return res.status(404).json({ error: 'not_found' });
      res.json(rows[0]);
    } catch (e) {
      if (e.message && e.message.includes('conflict')) {
        return res.status(409).json({ error: 'conflict' });
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
}

export async function removeEvent(req, res, next) {
  try {
    const { calendarId, id } = req.params;
    if (!(await ensureMembership(req.db, calendarId, req.user.id))) {
      return res.status(404).json({ error: 'not_found' });
    }
    await req.db.query(
      `DELETE FROM calendar_events
        WHERE id = $1 AND calendar_id = $2 AND org_id = $3 AND type = 'meeting'`,
      [id, calendarId, req.orgId]
    );
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
