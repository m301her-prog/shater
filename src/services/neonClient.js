// neonClient.js — Neon Serverless PostgreSQL connection.
//
// Uses @neondatabase/serverless to run queries over HTTP/WebSocket fetch.
//
// CONNECTION CONFIG:
//   Set VITE_NEON_CONNECTION_STRING in .env to your Neon connection string, e.g.
//   VITE_NEON_CONNECTION_STRING=postgres://user:pass@ep-xxx.region.aws.neon.tech/shatir?sslmode=require
//
// NOTE ON THIS ENVIRONMENT:
//   This sandbox provisions a Supabase Postgres instance (Neon tooling is not
//   available here). When no Neon connection string is present, neonClient falls
//   back to the Supabase REST (PostgREST) endpoint using the anon key so the app
//   keeps working end-to-end. The SQL schema in /schema.sql is identical on both.

import { neon } from '@neondatabase/serverless';

const NEON_CS = import.meta.env.VITE_NEON_CONNECTION_STRING;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasNeon = Boolean(NEON_CS);
export const hasFallback = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!hasNeon && !hasFallback) {
  // eslint-disable-next-line no-console
  console.error(
    'No database connection configured. Set VITE_NEON_CONNECTION_STRING (Neon) or VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.'
  );
}

// Neon SQL tagged-template client (only built when a connection string exists).
const sql = hasNeon ? neon(NEON_CS) : null;

/**
 * Run a parameterized SQL query against the database.
 * @param {string} text - SQL with $1, $2, ... placeholders
 * @param {any[]} params - parameter values
 * @returns {Promise<any[]>} rows
 */
export async function query(text, params = []) {
  if (hasNeon) {
    // neon() tagged template: pass the SQL string and params array.
    return sql(text, params);
  }
  throw new Error('Direct SQL query requires VITE_NEON_CONNECTION_STRING to be set.');
}

/**
 * Run a PostgREST RPC function (used by the Supabase fallback path).
 * @param {string} fn - function name in the public schema
 * @param {object} args - arguments object
 * @returns {Promise<any>} response data
 */
export async function rpc(fn, args = {}) {
  if (!hasFallback) throw new Error('No database fallback configured.');
  const url = `${SUPABASE_URL}/rest/v1/rpc/${fn}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`RPC ${fn} failed (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Generic PostgREST table helper (Supabase fallback). Returns all rows of a table.
 * @param {string} table
 * @param {object} opts - { select, order, filters: {col, op, val}[] }
 */
export async function restSelect(table, opts = {}) {
  if (!hasFallback) throw new Error('No database fallback configured.');
  const select = opts.select || '*';
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
  if (opts.order) {
    url += `&order=${encodeURIComponent(opts.order.col + '.' + opts.order.desc)}`;
  }
  if (opts.filters) {
    for (const f of opts.filters) {
      url += `&${encodeURIComponent(f.col)}=${encodeURIComponent(f.op + '.' + f.val)}`;
    }
  }
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`select ${table} failed (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Generic PostgREST insert (Supabase fallback).
 */
export async function restInsert(table, rows) {
  if (!hasFallback) throw new Error('No database fallback configured.');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`insert ${table} failed (${res.status}): ${body}`);
  }
  return res.json();
}

/**
 * Generic PostgREST update (Supabase fallback).
 */
export async function restUpdate(table, filters, patch) {
  if (!hasFallback) throw new Error('No database fallback configured.');
  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  for (const f of filters) {
    url += (url.includes('?') ? '&' : '?') + `${encodeURIComponent(f.col)}=${encodeURIComponent(f.op + '.' + f.val)}`;
  }
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'return=representation',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`update ${table} failed (${res.status}): ${body}`);
  }
  return res.json();
}
