/**
 * @testvibe/core — modèle de domaine généalogique (Person, Union, Filiation).
 *
 * Ce module ne dépend d'aucun framework web ni UI : il consomme
 * uniquement `@testvibe/db` (schéma Drizzle + factory de connexion)
 * pour exposer des opérations CRUD pures, testables isolément.
 */
export { CORE_PACKAGE_NAME } from "./constants.js";
export * from "./types.js";
export * from "./errors.js";
export * from "./person.js";
export * from "./union.js";
export * from "./filiation.js";
export * from "./tree.js";
export * from "./demo.js";
export * from "./web-api.js";
export * from "./admin-api.js";
export * from "./gedcom.js";
export * from "./event.js";
export * from "./media.js";
export * from "./search.js";
export * from "./comparative-timeline.js";
export * from "./anniversary.js";
