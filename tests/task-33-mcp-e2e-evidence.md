# Tâche #33 — preuves E2E MCP Vikunja

Ce fichier est un relevé de preuves, pas une réimplémentation locale des règles. Les écritures Vikunja ont été effectuées exclusivement par les outils MCP `vikunja`; aucune mutation REST n'est utilisée.

## Pré-requis et limite d'outillage

Le dépôt `rgrente/testvibe` ne contient pas le connecteur Hermes–Vikunja. Les outils MCP exposés à ce rôle permettent :

- `get_task` et `validate_for_execution` (lecture et garde réelle) ;
- `submit_for_review` (transition réelle du codeur vers Review).

Ils n'exposent pas d'opération générique de déplacement de bucket, ni les rôles refiner/reviewer/orchestrator nécessaires pour préparer Triage, soumettre l'approbation humaine, rejouer le parcours complet ou tenter une transition invalide. Le parcours antérieur ne doit donc pas être présenté comme entièrement démontré par ce rôle.

## Preuve MCP initiale (réelle)

Appel :

```text
mcp__vikunja__get_task(project_id=2, task_id=33)
```

Observations retournées par le connecteur :

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

Puis :

```text
mcp__vikunja__validate_for_execution(project_id=2, task_id=33)
```

Résultat réel : `executable: true`, `reasons: []`, contrat v2 `kind: code`, et `contract.human_review: false`.

Ces deux lectures démontrent que la garde réelle lit la colonne courante (bucket 15), accepte l'état In Development et constate l'absence de `human:review`. Elles ne prétendent pas démontrer les colonnes antérieures ni les refus de transitions qui ne sont pas exposés à ce rôle.

## Preuve MCP de transition codeur (réelle)

Après le nouveau commit, l'appel suivant est exécuté par MCP, avec le SHA complet :

```text
mcp__vikunja__submit_for_review(
  project_id=2,
  task_id=33,
  branch="agent/task-33",
  commit="4ee23a949ba74838c137b790e720edb0ab04a613",
  summary="Preuves E2E MCP réelles pour la carte #33",
  verification=["... résultats littéraux ..."]
)
```

Le résultat attendu et vérifié par lecture MCP est `review_bucket_id: 16`, puis :

```text
mcp__vikunja__get_task(project_id=2, task_id=33)
```

avec `bucket_id: 16`, `buckets[0].title: "Review"`, `done: false`, et sans label `human:review`.

Le SHA, les résultats littéraux et la sortie de lecture post-écriture sont complétés dans le commentaire MCP de soumission et dans le rapport final de l'agent. Aucun résultat n'est fabriqué dans ce fichier.

## Reproductibilité

Pour rejouer la partie disponible, utiliser les appels MCP ci-dessus avec la carte #33 et conserver la lecture avant/après. Ne pas remplacer ces appels par `curl` d'écriture. Pour couvrir Triage → Refinement → Awaiting Approval → Ready → In Development → Review → Done et les transitions invalides, il faut exposer les rôles/outils de workflow correspondants ou fournir une carte de test dédiée pilotable par l'orchestrateur et le reviewer.
