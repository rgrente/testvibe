import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import type { MapLocation } from "@testvibe/core";

vi.mock("./LeafletMap", () => ({
  default: ({ locations, onMarkerClick }: { locations: MapLocation[]; onMarkerClick: (location: MapLocation) => void }) => (
    <button type="button" onClick={() => onMarkerClick(locations[0])}>Marqueur Rennes</button>
  ),
}));

import MapClient from "./MapClient";

const location: MapLocation = {
  eventId: 7,
  source: "event",
  personId: 2,
  personName: "Martine Renault",
  type: "naissance",
  label: null,
  eventDate: "vers 1958-09",
  place: "Rennes (35)",
  latitude: 48.1173,
  longitude: -1.6778,
};

describe("MapClient UI", () => {
  it("relie filtres, marqueur, détail et liste dans des régions accessibles", async () => {
    render(<MapClient
      locations={[location]}
      selectedPersonIds={[]}
      dateFrom=""
      dateTo=""
      branchMode="none"
      onDateFromChange={vi.fn()}
      onDateToChange={vi.fn()}
      onBranchModeChange={vi.fn()}
      allPersons={[{ id: 2, name: "Martine Renault" }]}
      selectedPersonId={null}
      onSelectPerson={vi.fn()}
    />);

    expect(screen.getByRole("region", { name: "Filtres de la carte" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Carte des origines" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Liste des événements (1)" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Marqueur Rennes" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Détail du lieu Rennes (35)" })).toBeInTheDocument());
    expect(screen.getAllByText(/vers septembre 1958/)).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Fermer le détail" })).toHaveClass("min-h-11", "min-w-11");
  });
});