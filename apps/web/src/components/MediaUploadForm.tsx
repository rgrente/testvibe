"use client";

import { useRef, useState } from "react";

interface MediaUploadFormProps {
  personId: number;
  onUploadSuccess: () => void;
}

/**
 * Formulaire client-side d'upload de médias.
 * Appelle POST /api/media/upload avec le fichier et personId.
 * Phase 5 (tâche #24).
 */
export function MediaUploadForm({ personId, onUploadSuccess }: MediaUploadFormProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setStatus("uploading");
    setErrorMsg("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("personId", String(personId));

    try {
      const res = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? `Erreur HTTP ${res.status}`);
      }
      setStatus("success");
      if (fileRef.current) fileRef.current.value = "";
      onUploadSuccess();
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label htmlFor="media-file" className="mb-1 block text-sm font-medium text-slate-700">
          Fichier (JPG, PNG, GIF, WEBP, AVIF, PDF — max 20 Mo)
        </label>
        <input
          id="media-file"
          type="file"
          ref={fileRef}
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif,application/pdf"
          required
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-sm file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-200"
        />
      </div>
      {status === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}
      {status === "success" && (
        <p className="text-sm text-green-600">Média uploadé avec succès.</p>
      )}
      <div>
        <button
          type="submit"
          disabled={status === "uploading"}
          className="rounded-sm bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {status === "uploading" ? "Upload en cours…" : "Uploader"}
        </button>
      </div>
    </form>
  );
}
