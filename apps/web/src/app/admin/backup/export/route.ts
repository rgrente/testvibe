import { adminCreateBackup } from "@testvibe/core";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const archive = await adminCreateBackup();
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    return new Response(new Uint8Array(archive), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="testvibe-backup-${timestamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Backup creation failed." }, { status: 500 });
  }
}
