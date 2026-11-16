// Saving sets, sessions and labeled training reps in the browser (IndexedDB).
// Set and session shapes are in docs/data-contract.md under "Set and session".
import { openDB } from "idb";

const DB_NAME = "rep-tracker";
const SESSIONS = "sessions";
const LABELED_REPS = "labeledReps";

let dbPromise = null;

function getDb() {
  dbPromise ??= openDB(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore(SESSIONS, { keyPath: "date" });
      if (oldVersion < 2) db.createObjectStore(LABELED_REPS, { keyPath: ["video", "rep"] });
    },
    // Another tab needs a newer version: let go so its upgrade isn't stuck waiting on this one.
    blocking(_current, _blocked, event) {
      event.target.close();
      dbPromise = null;
    },
  });
  return dbPromise;
}

// Every [video, rep] key for one video. An empty array sorts after any rep number.
const videoRange = (video) => IDBKeyRange.bound([video], [video, []]);

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

/**
 * Replace everything saved for one video. Pass an empty list to remove the video.
 * @param {string} video file name
 * @param {object[]} reps labeled rep records, each with `video` and `rep`
 */
export async function saveLabeledReps(video, reps) {
  const db = await getDb();
  const tx = db.transaction(LABELED_REPS, "readwrite");
  await tx.store.delete(videoRange(video));
  await Promise.all(reps.map((r) => tx.store.put(r)));
  await tx.done;
}

/** Save one labeled rep record, replacing the same video and rep number. */
export async function saveLabeledRep(record) {
  const db = await getDb();
  await db.put(LABELED_REPS, record);
}

/**
 * @param {string} [video] file name; leave out for every video
 * @returns {Promise<object[]>} labeled rep records in video, then rep order
 */
export async function getLabeledReps(video) {
  const db = await getDb();
  return db.getAll(LABELED_REPS, video === undefined ? undefined : videoRange(video));
}
