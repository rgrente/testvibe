"use client";

import { useState } from "react";

interface MediaDeleteButtonProps {
  mediaId: number;
  filename: string;
}

/**
 * Bouton client-side de suppression d'un média.
 * Appelle DELETE /api/media/[filename]?id=<mediaId>.
 * Phase 5 (tâche #24).
 */
export function MediaDeleteButton({ mediaId, filename }: MediaDeleteButtonProps) {
  const [status, setStatus] = useState<"idle" | "deleting" | "done" | "error">("idle");

  async function handleDelete() {
    if (!confirm("Supprimer ce média ? Cette action est irréversible.")) return;
    setStatus("deleting");
    try {
      const res = await fetch(`/api/media/${filename}?id=${mediaId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus("done");
      // Refresh page
      window.location.reload();
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") return null;

  return (
    <button
      onClick={handleDelete}
      disabled={status === "deleting"}
      className="rounded-sm border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {status === "deleting" ? "…" : status === "error" ? "Erreur" : "Supprimer"}
    </button>
  );
}
