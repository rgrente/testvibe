import { describe, expect, it } from "vitest";
import { createMarkerTooltip } from "./LeafletMap";

describe("createMarkerTooltip", () => {
  it("rend les données importées comme du texte et jamais comme du HTML", () => {
    const tooltip = createMarkerTooltip('<img src=x onerror="alert(1)">', "<script>alert(2)</script>");

    expect(tooltip.textContent).toBe(
      '<img src=x onerror="alert(1)"> — <script>alert(2)</script>',
    );
    expect(tooltip.querySelector("img")).toBeNull();
    expect(tooltip.querySelector("script")).toBeNull();
  });
});
