import type { Event, Filiation, LivingStatus, Media, Person, Union, Visibility } from "./types.js";

const RANK: Record<Visibility, number> = { public: 0, family: 1, private: 2 };

export interface LivingPolicyOptions {
  now?: Date;
  thresholdYears?: number;
}

export function privacyThresholdYears(value = process.env.LIVING_PERSON_AGE_THRESHOLD): number {
  if (!/^\d+$/.test(value ?? "")) return 120;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 120;
}

export function inferLivingStatus(person: Person, options: LivingPolicyOptions = {}): LivingStatus {
  if (person.livingStatus === "deceased" || person.livingStatus === "living") return person.livingStatus;
  if (person.deathDate) return "deceased";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(person.birthDate ?? "")) return "living";
  const birth = new Date(`${person.birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime())) return "living";
  const now = options.now ?? new Date();
  if (birth.getTime() > now.getTime()) return "living";
  const threshold = options.thresholdYears ?? privacyThresholdYears();
  const boundary = new Date(now.getTime());
  boundary.setUTCFullYear(boundary.getUTCFullYear() - threshold);
  return birth.getTime() <= boundary.getTime() ? "deceased" : "living";
}

export function strictestVisibility(values: readonly Visibility[]): Visibility {
  if (values.length === 0) return "private";
  return values.reduce((strictest, value) => RANK[value] > RANK[strictest] ? value : strictest);
}

export function effectiveVisibility(
  subject: Person | readonly Visibility[],
  _options: LivingPolicyOptions = {},
): Visibility {
  if (Array.isArray(subject)) return strictestVisibility(subject);
  const person = subject as Person;
  if (person.visibility === "public" || person.visibility === "family" || person.visibility === "private") {
    return person.visibility;
  }
  return "public";
}

export function isVisibleToAudience(required: Visibility, audience: Visibility): boolean {
  return RANK[audience] >= RANK[required];
}

export interface PrivacyDataset {
  persons: Person[];
  unions: Union[];
  filiations: Filiation[];
  events: Event[];
  media: Media[];
}

export function filterPrivacyDataset(
  dataset: PrivacyDataset,
  audience: Visibility,
  options: LivingPolicyOptions = {},
): PrivacyDataset {
  const personVisibility = new Map(dataset.persons.map((person) => [
    person.id,
    effectiveVisibility(person, options),
  ]));
  const visiblePersonIds = new Set([...personVisibility]
    .filter(([, visibility]) => isVisibleToAudience(visibility, audience))
    .map(([id]) => id));
  const unionsById = new Map(dataset.unions.map((union) => [union.id, union]));

  const linkedPersonVisibilities = (event: Event): Visibility[] => {
    const personIds = new Set<number>([event.personId]);
    for (const id of event.unionId == null ? [] : unionsById.get(event.unionId)?.personIds ?? []) {
      personIds.add(id);
    }
    return [...personIds].flatMap((id) => {
      const visibility = personVisibility.get(id);
      return visibility ? [visibility] : [];
    });
  };
  const eventVisibility = new Map(dataset.events.map((event) => {
    const linked = linkedPersonVisibilities(event);
    const own = event.visibility ?? "public";
    return [event.id, linked.length === 0 ? "private" : strictestVisibility([own, ...linked])];
  }));
  const eventsById = new Map(dataset.events.map((event) => [event.id, event]));

  const mediaIsVisible = (item: Media): boolean => {
    const linked: Visibility[] = [];
    if (item.personId != null) {
      const visibility = personVisibility.get(item.personId);
      if (visibility) linked.push(visibility);
    }
    if (item.eventId != null && eventsById.has(item.eventId)) {
      const visibility = eventVisibility.get(item.eventId);
      if (visibility) linked.push(visibility);
    }
    if (linked.length === 0) return false;
    return isVisibleToAudience(strictestVisibility([item.visibility ?? "public", ...linked]), audience);
  };

  return {
    persons: dataset.persons.filter(({ id }) => visiblePersonIds.has(id)),
    unions: dataset.unions.filter(({ personIds }) =>
      personIds.length > 0 && personIds.every((id) => visiblePersonIds.has(id))),
    filiations: dataset.filiations.filter(({ parentId, childId }) =>
      visiblePersonIds.has(parentId) && visiblePersonIds.has(childId)),
    events: dataset.events.filter(({ id }) => {
      const visibility = eventVisibility.get(id);
      return visibility !== undefined && isVisibleToAudience(visibility, audience);
    }),
    media: dataset.media.filter(mediaIsVisible),
  };
}