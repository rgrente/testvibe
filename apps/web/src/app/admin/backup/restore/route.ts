import { adminRestoreBackup } from "@testvibe/core";
import { authorizeMutationRequest } from "@/lib/session";

export async function POST(request: Request) {
  const authorization = await authorizeMutationRequest(request);
  if (authorization) {
    return Response.json(
      { error: authorization === 401 ? "Unauthorized" : "Forbidden" },
      { status: authorization },
    );
  }

  const form = await request.formData();
  const archive = form.get("archive");
  const mode = form.get("mode")?.toString();
  const confirm = form.get("confirm")?.toString();
  if (
    typeof archive === "string"
    || archive === null
    || archive.size === 0
    || (mode !== "validate" && mode !== "replace")
  ) {
    return Response.json({ error: "Invalid backup request." }, { status: 400 });
  }
  if (mode === "replace" && confirm !== "REPLACE") {
    return Response.json({ error: "Strong replacement confirmation is required." }, { status: 400 });
  }

  try {
    const report = await adminRestoreBackup(Buffer.from(await archive.arrayBuffer()), { mode, confirm });
    return Response.json(report);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Backup restore failed." },
      { status: 400 },
    );
  }
}
