import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import type { FamilyFact, Media, Person } from "@testvibe/core";
import { PersonProfile } from "./PersonProfile";
import type { PersonRelations } from "../lib/person-relations";

const completePerson: Person = {
  id: 7,
  firstName: "Léni-Éléonore",
  lastName: "Grente de la Vallée",
  birthName: "Grente",
  birthDate: "2016-09-14",
  deathDate: null,
  gender: "X",
};

const facts: FamilyFact[] = [
  {
    id: 1,
    identity: "person:7:naissance",
    category: "naissance",
    type: "naissance",
    owner: "person:7",
    personIds: [7],
    date: "2016-09-14",
    eventDate: "2016-09-14",
    label: "Arrivée dans la famille",
    description: "Un événement décrit sans perte.",
    place: "Rennes (35)",
    latitude: null,
    longitude: null,
    source: "person",
    sourceEventId: null,
    conflicts: [],
  },
  {
    id: 2,
    identity: "event:2",
    category: "libre",
    type: "libre",
    owner: "person:7",
    personIds: [7],
    date: "2017-06",
    eventDate: "2017-06",
    label: "Baptême civil",
    description: null,
    place: "Vitré",
    latitude: null,
    longitude: null,
    source: "event",
    sourceEventId: 2,
    conflicts: [],
  },
];

const medias: Media[] = [
  { id: 1, personId: 7, eventId: null, filename: "portrait.jpg", originalName: "Portrait de Léni.jpg", mimeType: "image/jpeg", size: 123, createdAt: "2026-01-01" },
  { id: 2, personId: 7, eventId: null, filename: "acte.pdf", originalName: "Acte de naissance.pdf", mimeType: "application/pdf", size: 456, createdAt: "2026-01-01" },
];

const relationPerson = (id: number, firstName: string, gender: string): Person => ({
  id, firstName, lastName: "Test", birthName: null, birthDate: null, deathDate: null, gender,
});

const relations: PersonRelations = {
  parents: [{ person: relationPerson(2, "Mathilde", "F"), role: "Mère · biologique" }],
  partners: [{ person: relationPerson(3, "Alex", "X"), role: "Partenaire" }],
  children: [{ person: relationPerson(4, "Lou", "F"), role: "Fille · biologique" }],
};

describe("PersonProfile", () => {
  it("préserve identité, faits, relations, médias, actions et navigation", () => {
    render(<PersonProfile person={completePerson} facts={facts} medias={medias} relations={relations} />);

    expect(screen.getByRole("heading", { level: 1, name: "Léni-Éléonore Grente de la Vallée" })).toBeInTheDocument();
    const identity = screen.getByRole("region", { name: "Identité" });
    expect(within(identity).getByText("Grente")).toBeInTheDocument();
    expect(within(identity).getByText(/Rennes \(35\)/)).toBeInTheDocument();
    expect(within(identity).getByText("Vivant")).toBeInTheDocument();

    const relationsRegion = screen.getByRole("region", { name: "Relations" });
    expect(within(relationsRegion).getByRole("link", { name: /Mathilde Test/ })).toHaveAttribute("href", "/persons/2");
    expect(within(relationsRegion).getByText("Mère · biologique")).toBeInTheDocument();
    expect(within(relationsRegion).getByRole("link", { name: /Alex Test/ })).toBeInTheDocument();
    expect(within(relationsRegion).getByRole("link", { name: /Lou Test/ })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Portrait de Léni.jpg" })).toHaveAttribute("href", "/api/media/portrait.jpg");
    expect(screen.getByRole("link", { name: "Ouvrir Acte de naissance.pdf" })).toHaveAttribute("href", "/api/media/acte.pdf");
    expect(screen.getByRole("link", { name: "Voir dans l’arbre" })).toHaveAttribute("href", "/?personId=7");
    expect(screen.getByRole("link", { name: "Retour à l’arbre" })).toHaveAttribute("href", "/");

    const events = screen.getByRole("region", { name: "Événements" });
    const birthEvent = document.querySelector("#event-1");
    const baptismEvent = document.querySelector("#event-2");
    expect(birthEvent).not.toBeNull();
    expect(baptismEvent).not.toBeNull();
    expect(within(birthEvent as HTMLElement).getByText("Naissance")).toBeInTheDocument();
    expect(within(birthEvent as HTMLElement).getByText("Arrivée dans la famille")).toBeInTheDocument();
    expect(within(baptismEvent as HTMLElement).getByText("Événement")).toBeInTheDocument();
    expect(within(baptismEvent as HTMLElement).getByText("Baptême civil")).toBeInTheDocument();
    expect(within(events).getByText("Un événement décrit sans perte.")).toBeInTheDocument();
    expect(baptismEvent).toBeInTheDocument();
  });

  it("affiche des replis utiles pour une personne minimale et des sections vides", () => {
    const minimal: Person = { id: 8, firstName: "Al", lastName: "Li", birthName: null, birthDate: null, deathDate: null, gender: null };
    render(<PersonProfile person={minimal} facts={[]} medias={[]} relations={{ parents: [], partners: [], children: [] }} />);

    expect(screen.getByText(/Genre non renseigné/)).toBeInTheDocument();
    expect(screen.getByText(/Date non renseignée/)).toBeInTheDocument();
    expect(screen.getByText("Aucune relation connue.")).toBeInTheDocument();
    expect(screen.getByText("Aucun média associé.")).toBeInTheDocument();
    expect(screen.getByText("Aucun événement enregistré pour cette personne.")).toBeInTheDocument();
  });

  it("remplace une image cassée par les initiales, indépendamment de la couleur", () => {
    render(<PersonProfile person={completePerson} facts={facts} medias={medias} relations={relations} />);
    fireEvent.error(screen.getByRole("img", { name: "Portrait de Léni.jpg" }));
    expect(screen.getByLabelText("Portrait indisponible — LG")).toBeInTheDocument();
  });
});
