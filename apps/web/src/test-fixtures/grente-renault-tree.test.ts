import { describe, expect, it } from "vitest";
import { grenteRenaultTree } from "./grente-renault-tree";

describe("fixture visuelle Grente–Renault", () => {
  it("reste normative : 10 personnes, 3 générations, 3 genres, 2 unions et 4 membres de fratrie", () => {
    expect(grenteRenaultTree.nodes).toHaveLength(10);
    expect(new Set(grenteRenaultTree.nodes.map((node) => node.generation))).toEqual(new Set([-1, 0, 1]));
    expect(new Set(grenteRenaultTree.nodes.map((node) => node.person.gender).filter(Boolean))).toEqual(new Set(["M", "F", "autre"]));
    expect(grenteRenaultTree.edges.filter((edge) => edge.type === "union")).toHaveLength(2);
    expect(grenteRenaultTree.nodes.filter((node) => node.generation === 0 && node.person.id !== 6)).toHaveLength(4);
    expect(grenteRenaultTree.nodes.some((node) => node.person.birthDate?.length === 4)).toBe(true);
    expect(grenteRenaultTree.nodes.some((node) => `${node.person.firstName} ${node.person.lastName}`.length > 32)).toBe(true);
  });
});
