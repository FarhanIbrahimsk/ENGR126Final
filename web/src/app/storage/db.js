// Saving sets and sessions in the browser (IndexedDB).
// Shapes are in docs/data-contract.md under "Set and session".
import { openDB } from "idb";

const DB_NAME = "rep-tracker";
const SESSIONS = "sessions";

let dbPromise = null;

function getDb() {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(SESSIONS, { keyPath: "date" });
    },
  });
  return dbPromise;
}

// The local calendar day a set belongs to, e.g. "2026-11-03". Local rather than UTC so an
// evening workout doesn't land on the next day.
function sessionDate(setId) {
  const d = new Date(setId);
  if (Number.isNaN(d.getTime())) throw new Error(`Set id should be an ISO timestamp: ${setId}`);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Save a set into the session for its day. Saving the same id again replaces that set.
 * @param {{ id: string, lift: string, weightLbs: number, reps: object[] }} set
 * @returns {Promise<object>} the updated session
 */
export async function saveSet(set) {
  const date = sessionDate(set.id);
  const db = await getDb();
  const tx = db.transaction(SESSIONS, "readwrite");
  const session = (await tx.store.get(date)) ?? { date, sets: [] };
  const existing = session.sets.findIndex((s) => s.id === set.id);
  if (existing >= 0) session.sets[existing] = set;
  else session.sets.push(set);
  await tx.store.put(session);
  await tx.done;
  return session;
}

/** @returns {Promise<object[]>} every session, newest first */
export async function getSessions() {
  const db = await getDb();
  return (await db.getAll(SESSIONS)).reverse();
}

/**
 * @param {string} date local day, e.g. "2026-11-03"
 * @returns {Promise<object|null>} that day's session, or null if there isn't one
 */
export async function getSession(date) {
  const db = await getDb();
  return (await db.get(SESSIONS, date)) ?? null;
}
