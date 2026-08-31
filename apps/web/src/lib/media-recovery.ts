import { join } from "node:path";

export interface MediaRecoveryOps {
  readdir(directory: string): Promise<string[]>;
  rename(from: string, to: string): Promise<void>;
  unlink(path: string): Promise<void>;
  getMedia(id: number): Promise<{ id: number; filename: string }>;
  getMediaByFilename(filename: string): Promise<{ id: number; filename: string }>;
}

async function mediaRecordExists(ops: MediaRecoveryOps, id: number, filename: string): Promise<boolean> {
  try {
    const media = await ops.getMedia(id);
    return media.filename === filename;
  } catch {
    return false;
  }
}

export async function recoverMediaArtifacts(directory: string, ops: MediaRecoveryOps): Promise<void> {
  const entries = await ops.readdir(directory);
  for (const entry of entries) {
    const upload = /^\.uploading-(pending|\d+)-([a-zA-Z0-9._-]+)$/.exec(entry);
    if (upload) {
      const source = join(directory, entry);
      if (upload[1] === "pending") {
        let media: { id: number; filename: string } | null = null;
        try {
          media = await ops.getMediaByFilename(upload[2]);
        } catch {
          // No committed metadata means the staging file can be discarded.
        }
        if (media?.filename === upload[2]) {
          await ops.rename(source, join(directory, upload[2]));
        } else {
          await ops.unlink(source);
        }
      } else if (await mediaRecordExists(ops, Number(upload[1]), upload[2])) {
        await ops.rename(source, join(directory, upload[2]));
      } else {
        await ops.unlink(source);
      }
      continue;
    }

    const deletion = /^\.deleting-(\d+)-([a-zA-Z0-9._-]+)$/.exec(entry);
    if (!deletion) continue;
    const source = join(directory, entry);
    if (await mediaRecordExists(ops, Number(deletion[1]), deletion[2])) {
      await ops.rename(source, join(directory, deletion[2]));
    } else {
      await ops.unlink(source);
    }
  }
}
