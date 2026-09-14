// Spike-only route: exercises server functions + D1 in isolation from the real app.
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listPings, addPing } from "@/spike/pingsServerFn";

export const Route = createFileRoute("/spike-d1")({
  component: SpikeD1Page,
});

function SpikeD1Page() {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const { data: pings, isPending } = useQuery({
    queryKey: ["spike-pings"],
    queryFn: () => listPings(),
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    await addPing({ data: message });
    setMessage("");
    queryClient.invalidateQueries({ queryKey: ["spike-pings"] });
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", color: "white" }}>
      <h1>D1 + Server Function spike</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="say something"
        />
        <button type="submit">Add ping</button>
      </form>
      {isPending ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {pings?.map((p) => (
            <li key={p.id}>
              #{p.id} — {p.message} ({new Date(p.created_at).toLocaleTimeString()})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
