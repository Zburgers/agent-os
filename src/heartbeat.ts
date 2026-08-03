const heartbeatSql = `INSERT INTO supervisor_heartbeats(worker_id,status,detail) VALUES($1,$2,$3)
     ON CONFLICT(worker_id) DO UPDATE SET heartbeat_at=now(),status=EXCLUDED.status,detail=EXCLUDED.detail`;

type HeartbeatDatabase = { query(input: { text: string; values: unknown[]; query_timeout: number }): Promise<unknown> };

export async function writeHeartbeat(database: HeartbeatDatabase, workerId: string, status: string, detail: Record<string, unknown> = {}) {
  await database.query({ text: heartbeatSql, values: [workerId, status, JSON.stringify(detail)], query_timeout: 5000 });
}
