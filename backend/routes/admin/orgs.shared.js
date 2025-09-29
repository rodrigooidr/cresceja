import dbModule, { query as fallbackQuery } from '#db';

const baseQuery =
  typeof dbModule?.query === 'function'
    ? dbModule.query.bind(dbModule)
    : typeof fallbackQuery === 'function'
    ? fallbackQuery
    : null;

async function execQuery(sql, params) {
  if (!baseQuery) {
    const err = new Error('database_unavailable');
    err.status = 500;
    throw err;
  }
  return baseQuery(sql, params);
}

async function queryRows(sql, params) {
  const result = await execQuery(sql, params);
  return result?.rows ?? [];
}

async function queryOneOrNone(sql, params) {
  const rows = await queryRows(sql, params);
  return rows[0] ?? null;
}

async function queryOne(sql, params) {
  const row = await queryOneOrNone(sql, params);
  if (!row) {
    const err = new Error('not_found');
    err.status = 404;
    throw err;
  }
  return row;
}

async function queryNone(sql, params) {
  await execQuery(sql, params);
}

export const db = {
  query: execQuery,
  any: queryRows,
  oneOrNone: queryOneOrNone,
  one: queryOne,
  none: queryNone,
};

export default db;
