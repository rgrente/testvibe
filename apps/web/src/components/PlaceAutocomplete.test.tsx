import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import PlaceAutocomplete from "./PlaceAutocomplete";

function mockFetchSuccess(suggestions: unknown[]) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ suggestions }),
  });
}

function fieldValue(name: string, container: HTMLElement): string | null {
  return (
    (container.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value ??
    null
  );
}

describe("PlaceAutocomplete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche la valeur initiale et pré-remplit les champs", () => {
    const { container } = render(
      <PlaceAutocomplete
        defaultPlace="Lyon"
        defaultLatitude={45.764}
        defaultLongitude={4.8357}
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue("Lyon");
    expect(fieldValue("place", container)).toBe("Lyon");
    expect(fieldValue("latitude", container)).toBe("45.764");
    expect(fieldValue("longitude", container)).toBe("4.8357");
  });

  it("recherche les suggestions via la route proxy et les affiche", async () => {
    mockFetchSuccess([
      {
        label: "Paris, Île-de-France, France",
        latitude: 48.8566,
        longitude: 2.3522,
      },
    ]);

    render(<PlaceAutocomplete debounceMs={0} />);
    const input = screen.getByRole("combobox");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Par" } });

    const option = await screen.findByRole("option");
    expect(option).toHaveTextContent("Paris, Île-de-France, France");

    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string];
    expect(String(url)).toContain("/admin/geocode?q=Par");
  });

  it("sélectionne une suggestion : remplit place/latitude/longitude et notifie", async () => {
    mockFetchSuccess([
      {
        label: "Paris, Île-de-France, France",
        latitude: 48.8566,
        longitude: 2.3522,
      },
    ]);
    const onPlaceSelected = vi.fn();

    const { container } = render(
      <PlaceAutocomplete debounceMs={0} onPlaceSelected={onPlaceSelected} />,
    );
    const input = screen.getByRole("combobox");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Par" } });

    const option = await screen.findByRole("option");
    fireEvent.mouseDown(option);

    expect(onPlaceSelected).toHaveBeenCalledWith(
      "Paris, Île-de-France, France",
      48.8566,
      2.3522,
    );
    expect(screen.getByRole("combobox")).toHaveValue("Paris, Île-de-France, France");
    expect(fieldValue("place", container)).toBe("Paris, Île-de-France, France");
    expect(fieldValue("latitude", container)).toBe("48.8566");
    expect(fieldValue("longitude", container)).toBe("2.3522");
  });

  it("réinitialise les coordonnées lors d'une saisie manuelle du lieu", () => {
    const { container } = render(
      <PlaceAutocomplete
        defaultPlace="Lyon"
        defaultLatitude={45.764}
        defaultLongitude={4.8357}
        debounceMs={0}
      />,
    );
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Par" } });

    expect(fieldValue("latitude", container)).toBe("");
    expect(fieldValue("longitude", container)).toBe("");
  });

  it("permet la saisie manuelle directe des coordonnées", () => {
    const { container } = render(<PlaceAutocomplete />);
    const latitude = container.querySelector(
      '[name="latitude"]',
    ) as HTMLInputElement;

    fireEvent.change(latitude, { target: { value: "48.8566" } });

    expect(fieldValue("latitude", container)).toBe("48.8566");
  });

  it("n'effectue aucune requête en dessous du nombre minimal de caractères", () => {
    mockFetchSuccess([]);
    const { container } = render(<PlaceAutocomplete minChars={3} debounceMs={0} />);
    const input = screen.getByRole("combobox");

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Pa" } });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});
