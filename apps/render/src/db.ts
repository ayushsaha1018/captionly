import { Database, type SQLQueryBindings } from "bun:sqlite";
import { join } from "node:path";

const db = new Database(join(import.meta.dir, "../jobs.sqlite"));
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'queued',
    progress REAL NOT NULL DEFAULT 0,
    rendered_frames INTEGER NOT NULL DEFAULT 0,
    total_frames INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    work_dir TEXT NOT NULL,
    origin TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    duration_sec REAL,
    fps INTEGER,
    created_at INTEGER NOT NULL
  )
`);

export type JobStatus = "queued" | "processing" | "complete" | "error";

export type Job = {
  id: string;
  status: JobStatus;
  progress: number;
  rendered_frames: number;
  total_frames: number;
  error: string | null;
  work_dir: string;
  origin: string;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
  fps: number | null;
  created_at: number;
};

export function createJob(job: {
  id: string;
  workDir: string;
  origin: string;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  fps: number | null;
}): void {
  db.run(
    `INSERT INTO jobs (id, work_dir, origin, width, height, duration_sec, fps, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [job.id, job.workDir, job.origin, job.width, job.height, job.durationSec, job.fps, Date.now()],
  );
}

export function updateJob(
  id: string,
  fields: Partial<Pick<Job, "status" | "progress" | "rendered_frames" | "total_frames" | "error">>,
): void {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const values = keys.map((k) => (fields as Record<string, unknown>)[k]) as SQLQueryBindings[];
  db.run(`UPDATE jobs SET ${sets} WHERE id = ?`, [...values, id]);
}

export function getJob(id: string): Job | null {
  return db.query(`SELECT * FROM jobs WHERE id = ?`).get(id) as Job | null;
}

export function getNextQueuedJob(): Job | null {
  return db.query(`SELECT * FROM jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`).get() as Job | null;
}

export function getStaleJobs(olderThanMs: number): Job[] {
  const cutoff = Date.now() - olderThanMs;
  return db
    .query(`SELECT * FROM jobs WHERE created_at < ? AND status IN ('complete', 'error')`)
    .all(cutoff) as Job[];
}

export function deleteJob(id: string): void {
  db.run(`DELETE FROM jobs WHERE id = ?`, [id]);
}
