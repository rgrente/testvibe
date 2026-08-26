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

const keyboardSuggestions = [
  { label: "Paris", latitude: 48.8566, longitude: 2.3522 },
  { label: "Lyon", latitude: 45.764, longitude: 4.8357 },
];

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

  it("déplace l'option active avec ArrowDown et boucle sans soumettre", async () => {
    mockFetchSuccess(keyboardSuggestions);
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PlaceAutocomplete debounceMs={0} />
      </form>,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Par" } });
    const options = await screen.findAllByRole("option");

    expect(fireEvent.keyDown(input, { key: "ArrowDown" })).toBe(false);
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    expect(input).toHaveAttribute("aria-activedescendant", options[0].id);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("déplace l'option active avec ArrowUp et boucle sans soumettre", async () => {
    mockFetchSuccess(keyboardSuggestions);
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PlaceAutocomplete debounceMs={0} />
      </form>,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Par" } });
    const options = await screen.findAllByRole("option");

    expect(fireEvent.keyDown(input, { key: "ArrowUp" })).toBe(false);
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveAttribute("aria-activedescendant", options[1].id);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("déplace le style visuel de l'option active avec le clavier", async () => {
    mockFetchSuccess(keyboardSuggestions);
    render(<PlaceAutocomplete debounceMs={0} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Par" } });
    const options = await screen.findAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]).toHaveClass("bg-slate-100");
    expect(options[1]).not.toHaveClass("bg-slate-100");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(options[0]).not.toHaveClass("bg-slate-100");
    expect(options[1]).toHaveClass("bg-slate-100");
  });

  it("retire l'option active quand la saisie change", async () => {
    mockFetchSuccess(keyboardSuggestions);
    render(<PlaceAutocomplete debounceMs={0} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Par" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });

    fireEvent.change(input, { target: { value: "Lyo" } });

    expect(input).not.toHaveAttribute("aria-activedescendant");
    for (const option of screen.getAllByRole("option")) {
      expect(option).toHaveAttribute("aria-selected", "false");
    }
  });

  it("retire l'option active quand la liste perd le focus", async () => {
    mockFetchSuccess(keyboardSuggestions);
    render(<PlaceAutocomplete debounceMs={0} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Par" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });

    fireEvent.blur(input);
    fireEvent.focus(input);

    for (const option of await screen.findAllByRole("option")) {
      expect(option).toHaveAttribute("aria-selected", "false");
    }
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("sélectionne l'option active avec Enter et ferme la liste", async () => {
    mockFetchSuccess(keyboardSuggestions);
    const onPlaceSelected = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { container } = render(
      <form onSubmit={onSubmit}>
        <PlaceAutocomplete debounceMs={0} onPlaceSelected={onPlaceSelected} />
      </form>,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Par" } });
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });

    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    expect(input).toHaveValue("Lyon");
    expect(fieldValue("latitude", container)).toBe("45.764");
    expect(fieldValue("longitude", container)).toBe("4.8357");
    expect(onPlaceSelected).toHaveBeenCalledWith("Lyon", 45.764, 4.8357);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("laisse Enter suivre le comportement du formulaire sans option active", async () => {
    mockFetchSuccess(keyboardSuggestions);
    const onPlaceSelected = vi.fn();
    const { container } = render(
      <PlaceAutocomplete debounceMs={0} onPlaceSelected={onPlaceSelected} />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Par" } });
    await screen.findAllByRole("option");

    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(true);
    expect(input).toHaveValue("Par");
    expect(fieldValue("latitude", container)).toBe("");
    expect(fieldValue("longitude", container)).toBe("");
    expect(onPlaceSelected).not.toHaveBeenCalled();
  });

  it("ferme la liste avec Escape sans modifier les valeurs ni notifier", async () => {
    mockFetchSuccess(keyboardSuggestions);
    const onPlaceSelected = vi.fn();
    const { container } = render(
      <PlaceAutocomplete
        defaultPlace="Paris"
        defaultLatitude={48.8566}
        defaultLongitude={2.3522}
        debounceMs={0}
        onPlaceSelected={onPlaceSelected}
      />,
    );
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await screen.findAllByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });

    fireEvent.keyDown(input, { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute("aria-activedescendant");
    expect(input).toHaveValue("Paris");
    expect(fieldValue("latitude", container)).toBe("48.8566");
    expect(fieldValue("longitude", container)).toBe("2.3522");
    expect(onPlaceSelected).not.toHaveBeenCalled();

    fireEvent.focus(input);
    for (const option of await screen.findAllByRole("option")) {
      expect(option).toHaveAttribute("aria-selected", "false");
    }
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });
});
