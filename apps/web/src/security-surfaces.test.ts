import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function filesRecursively(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesRecursively(path) : [path];
  }))).flat();
}

describe("mutating security surfaces", () => {
  it("defends every admin Server Action inside the action itself", async () => {
    const root = resolve(process.cwd(), "src/app/admin");
    const files = (await filesRecursively(root)).filter((file) => /\.tsx?$/.test(file));
    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (source.startsWith('"use server";')) {
        for (const action of source.matchAll(/export async function \w+\([^)]*\)\s*\{/g)) {
          expect(source.slice(action.index + action[0].length, action.index + action[0].length + 300), file)
            .toMatch(/requireAdminMutation\(/);
        }
        continue;
      }
      const actions = source.split(/^[\t ]*["']use server["'];/m).slice(1);
      for (const action of actions) {
        expect(action.slice(0, 500), file).toMatch(/require(Admin|Login)Mutation\(/);
      }
    }
  });

  it("authorizes both mutating media handlers before processing input", async () => {
    const upload = await readFile(resolve(process.cwd(), "src/app/api/media/upload/route.ts"), "utf8");
    const media = await readFile(resolve(process.cwd(), "src/app/api/media/[filename]/route.ts"), "utf8");
    const uploadGuard = upload.indexOf("authorizeMutationRequest");
    const deleteGuard = media.indexOf("authorizeMutationRequest", media.indexOf("export async function DELETE"));
    expect(uploadGuard).toBeGreaterThanOrEqual(0);
    expect(uploadGuard).toBeLessThan(upload.indexOf("request.formData"));
    expect(deleteGuard).toBeGreaterThanOrEqual(0);
    expect(deleteGuard).toBeLessThan(media.indexOf("adminGetMedia", media.indexOf("export async function DELETE")));
  });
});
