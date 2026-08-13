// Shared helper for the states normalization work (master-dev-prompt
// Section C#1). Was duplicated identically in routes/districts.js and
// routes/colleges.js -- pulled out so a future fix to the matching rule
// only has to happen once.

// Resolve a state name to its states.id (case-insensitive, whitespace-
// tolerant -- matches the LOWER(TRIM()) rule check-db.js's backfill uses,
// so a value like "Bihar " that was silently failing to resolve before
// now matches the same way it would on the one-time migration backfill).
// Returns null if it doesn't match a seeded state, in which case the
// caller's free-text `state` column is still written so nothing is
// silently dropped.
async function resolveStateId(connection, stateName) {
  if (!stateName) return null;
  const [[row]] = await connection.query('SELECT id FROM states WHERE LOWER(name) = LOWER(TRIM(?))', [stateName]);
  return row ? row.id : null;
}

module.exports = { resolveStateId };
