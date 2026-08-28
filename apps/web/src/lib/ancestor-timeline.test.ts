import type { FamilyTree, Person } from "@testvibe/core";
import { describe, expect, it } from "vitest";
import { selectAncestorTimeline } from "./ancestor-timeline";
import { assignConnectionLanes } from "./comparative-timeline";

const person = (id: number, birthDate: string): Person => ({ id, firstName: `P${id}`, lastName: "Test", birthName: null, birthDate, deathDate: null, gender: null });

describe("selectAncestorTimeline", () => {
  it("limite la profondeur, exclut les collatéraux et calcule âge et lignée", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: [
        { person: person(1, "2000-06-01"), generation: 0 },
        { person: person(2, "1970"), generation: -1 },
        { person: person(3, "1972"), generation: -1 },
        { person: person(4, "1940"), generation: -2 },
        { person: person(9, "2002"), generation: 0 },
      ],
      edges: [
        { type: "filiation", filiationId: 1, parentId: 2, childId: 1, role: "biologique" },
        { type: "filiation", filiationId: 2, parentId: 3, childId: 1, role: "biologique" },
        { type: "filiation", filiationId: 3, parentId: 4, childId: 2, role: "biologique" },
        { type: "filiation", filiationId: 4, parentId: 2, childId: 9, role: "biologique" },
      ],
    };

    const selection = selectAncestorTimeline(tree, 2);
    expect(selection.personIds).toEqual([4, 2, 3, 1]);
    expect(selection.connections).toContainEqual({ parentId: 2, childId: 1, age: 30 });
    expect(selection.branchByPersonId.get(4)).toBe(selection.branchByPersonId.get(2));
    expect(selection.personIds.map((id) => selection.generationByPersonId.get(id))).toEqual([1, 2, 2, 3]);
    expect(selection.personIds).not.toContain(9);
  });

  it("évite les collisions de couloirs dans un arbre complet sur quatre générations", () => {
    const tree: FamilyTree = {
      rootId: 1,
      nodes: Array.from({ length: 31 }, (_, index) => ({
        person: person(index + 1, `${2000 - Math.floor(Math.log2(index + 1)) * 30}`),
        generation: -Math.floor(Math.log2(index + 1)),
      })),
      edges: Array.from({ length: 15 }, (_, index) => index + 1).flatMap((childId) => [
        { type: "filiation" as const, filiationId: childId * 2, parentId: childId * 2, childId, role: "biologique" as const },
        { type: "filiation" as const, filiationId: childId * 2 + 1, parentId: childId * 2 + 1, childId, role: "biologique" as const },
      ]),
    };

    const selection = selectAncestorTimeline(tree, 4);
    const rowByPersonId = new Map(selection.personIds.map((id, index) => [id, index]));
    const ranges = selection.connections.map(({ parentId, childId }) => {
      const parentRow = rowByPersonId.get(parentId)!;
      const childRow = rowByPersonId.get(childId)!;
      return { firstRow: Math.min(parentRow, childRow) + 1, lastRow: Math.max(parentRow, childRow) + 2 };
    });
    const lanes = assignConnectionLanes(ranges);
    const collisions = ranges.flatMap((range, index) =>
      ranges.slice(index + 1).filter((otherRange, offset) =>
        lanes[index] === lanes[index + offset + 1] &&
        Math.max(range.firstRow, otherRange.firstRow) < Math.min(range.lastRow, otherRange.lastRow),
      ),
    );

    expect(selection.connections).toHaveLength(30);
    expect(collisions).toHaveLength(0);
  });
});
