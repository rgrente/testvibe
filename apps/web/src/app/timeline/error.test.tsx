import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import TimelineError from "./error";

describe("TimelineError", () => {
  it("annonce l’erreur et permet de réessayer", () => {
    const reset = vi.fn();
    render(<TimelineError error={new Error("indisponible")} reset={reset} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Impossible de charger la chronologie");
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});