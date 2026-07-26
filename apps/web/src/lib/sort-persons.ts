import type { Person } from "@testvibe/core";

const textCollator = new Intl.Collator("fr", { sensitivity: "base" });

/**
 * Returns a chronologically ordered copy for the filiation forms.
 */
export function sortPersonsChronologically(persons: readonly Person[]): Person[] {
  return [...persons].sort((left, right) => {
    if (left.birthDate !== right.birthDate) {
      if (left.birthDate == null) return 1;
      if (right.birthDate == null) return -1;

      const dateOrder = Date.parse(left.birthDate) - Date.parse(right.birthDate);
      if (dateOrder !== 0) return dateOrder;
    }

    const lastNameOrder = textCollator.compare(left.lastName, right.lastName);
    if (lastNameOrder !== 0) return lastNameOrder;

    const firstNameOrder = textCollator.compare(left.firstName, right.firstName);
    if (firstNameOrder !== 0) return firstNameOrder;

    return left.id - right.id;
  });
}
