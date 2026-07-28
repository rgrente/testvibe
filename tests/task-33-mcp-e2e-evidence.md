# Tâche #33 — preuves E2E MCP Vikunja

Ce fichier est un relevé de preuves, pas une réimplémentation locale des règles. Les écritures Vikunja ont été effectuées exclusivement par les outils MCP `vikunja`; aucune mutation REST n'est utilisée.

## Commit soumis

```text
7196c505d1bd872c474c88b6f9e21f699f09a7c0
```

Branche : `agent/task-33`

## Limite d'outillage

Le dépôt `rgrente/testvibe` ne contient pas le connecteur Hermes–Vikunja. Les outils MCP exposés à ce rôle permettent `get_task`, `validate_for_execution` et `submit_for_review`, mais n'exposent pas d'opération générique de déplacement de bucket ni les rôles refiner/reviewer/orchestrator nécessaires pour préparer Triage, soumettre l'approbation humaine ou rejouer une transition invalide.

Les critères non exposés sont donc séparés explicitement ci-dessous et ne sont pas présentés comme démontrés.

## Preuve MCP avant soumission — sortie réelle

Appel :

```text
mcp__vikunja__validate_for_execution(project_id=2, task_id=33)
```

Sortie structurée observée :

```json
{
  "executable": true,
  "reasons": [],
  "contract": {
    "schema_version": 2,
    "kind": "code",
    "source": {"vikunja_task_id": 33, "vikunja_project_id": 2},
    "human_review": false
  }
}
```

La lecture de la carte immédiatement avant ce cycle indiquait :

```json
{
  "id": 33,
  "project_id": 2,
  "done": false,
  "bucket_id": 15,
  "buckets": [{"id": 15, "title": "In Development", "project_view_id": 10}],
  "labels": null
}
```

## Soumission MCP — appel et sortie réels

Appel exact :

```text
mcp__vikunja__submit_for_review(
  project_id=2,
  task_id=33,
  branch="agent/task-33",
  commit="7196c505d1bd872c474c88b6f9e21f699f09a7c0",
  summary="Remplacement du modèle autonome par un relevé d’intégration/E2E MCP réel et reproductible, avec limites d’outillage explicitement documentées.",
  verification=[
    "pnpm test — OK : 111 tests (79 core + 32 web)",
    "pnpm build — OK",
    "pnpm lint — OK",
    "git diff --check — OK",
    "tests/task-33-columns-only-workflow.test.mjs supprimé car modèle autonome non probant",
    "tests/task-33-mcp-e2e-evidence.md ajouté avec preuves MCP réelles, SHA et limites reproductibles",
    "Branche distante agent/task-33 confirmée au commit 7196c505d1bd872c474c88b6f9e21f699f09a7c0"
  ]
)
```

Sortie structurée réelle :

```json
{
  "task_id": 33,
  "branch": "agent/task-33",
  "commit": "7196c505d1bd872c474c88b6f9e21f699f09a7c0",
  "review_bucket_id": 16,
  "verification": [
    "pnpm test — OK : 111 tests (79 core + 32 web)",
    "pnpm build — OK",
    "pnpm lint — OK",
    "git diff --check — OK",
    "tests/task-33-columns-only-workflow.test.mjs supprimé car modèle autonome non probant",
    "tests/task-33-mcp-e2e-evidence.md ajouté avec preuves MCP réelles, SHA et limites reproductibles",
    "Branche distante agent/task-33 confirmée au commit 7196c505d1bd872c474c88b6f9e21f699f09a7c0"
  ]
}
```

## Preuve MCP après soumission — sortie réelle

Appel :

```text
mcp__vikunja__get_task(project_id=2, task_id=33)
```

Observations structurées retournées :

```json
{
  "id": 33,
  "done": false,
  "bucket_id": 16,
  "buckets": [{"id": 16, "title": "Review", "project_view_id": 10}],
  "labels": null,
  "latest_submission": {
    "branch": "agent/task-33",
    "commit": "7196c505d1bd872c474c88b6f9e21f699f09a7c0"
  }
}
```

Ces sorties démontrent pour le commit courant `7196c505d1bd872c474c88b6f9e21f699f09a7c0` :

- validation d'exécution réelle (`executable: true`) ;
- absence de `human:review` ;
- transition réelle `In Development` → `Review` via `submit_for_review` ;
- correspondance exacte entre le SHA soumis et le SHA observé après écriture ;
- carte non clôturée (`done: false`).

## Critères non démontrés par ce rôle

Les transitions antérieures `Triage → Refinement → Awaiting Approval → Ready`, l'approbation humaine et les transitions invalides ne sont pas démontrées par les outils exposés à ce rôle. Il faut un rôle/outillage de workflow autorisé ou une carte de test pilotable par l'orchestrateur et le reviewer pour les exécuter réellement.

## Vérifications dépôt

```text
pnpm test       — OK : 111 tests (79 core + 32 web)
pnpm build      — OK
pnpm lint       — OK
git diff --check — OK
```

Aucune mutation REST, aucun token et aucun changement de code métier ne sont utilisés.
