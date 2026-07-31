"use client";

import { useCallback, useEffect, useState } from "react";

type SlaTask = {
  trackerId: string;
  transactionId: string;
  domain: string;
  targetAtWib: string;
  escalationCount: number;
  finalNotificationFailure: { at: string | null; attempts: number } | null;
};

export default function SlaTaskSummary({
  domain
}: {
  domain: "PAYMENT" | "CONFIRMATION" | "CANCELLATION" | "FINANCIAL";
}) {
  const [tasks, setTasks] = useState<SlaTask[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");

  const load = useCallback(async () => {
    setState("loading");
    const response = await fetch(
      `/api/admin/tasks/sla?domain=${domain}&status=OVERDUE&limit=10`,
      { cache: "no-store" }
    );
    if (!response.ok) {
      setState("error");
      return;
    }
    const result = await response.json() as { items: SlaTask[] };
    setTasks(result.items);
    setState(result.items.length ? "ready" : "empty");
  }, [domain]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="payment-panel" aria-labelledby={`sla-${domain}`}>
      <p className="section-label" id={`sla-${domain}`}>SLA dan notifikasi</p>
      {state === "loading" && <p className="muted" role="status">Memuat tugas...</p>}
      {state === "empty" && <p className="muted">Tidak ada tugas melewati SLA.</p>}
      {state === "error" && (
        <p className="form-error" role="alert">
          Tugas SLA tidak dapat dimuat atau assignment belum tersedia.
        </p>
      )}
      {state === "ready" && (
        <ul className="participant-list">
          {tasks.map((task) => (
            <li key={task.trackerId}>
              <strong>{task.domain}</strong> · {task.transactionId.slice(0, 8)}
              {" · "}{task.targetAtWib} WIB
              {task.escalationCount ? ` · eskalasi ${task.escalationCount}` : ""}
              {task.finalNotificationFailure ? " · pengiriman gagal" : ""}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="secondary-button" onClick={load} disabled={state === "loading"}>
        Perbarui
      </button>
    </section>
  );
}
