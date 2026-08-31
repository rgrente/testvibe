/**
 * Erreurs de domaine partagées par les modules CRUD de packages/core.
 */
export class NotFoundError extends Error {
  constructor(entity: string, id: number | string) {
    super(`${entity} introuvable pour l'id ${id}`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
