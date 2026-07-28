# Tâche #33 — preuves MCP Vikunja accessibles au coder

Ce relevé contient uniquement les observations MCP obtenues pendant le cycle courant et les contrôles locaux exécutés dans ce dépôt. Il ne redéfinit pas le workflow columns-only, ne simule aucune transition et ne contient aucune sortie MCP inventée. Aucune mutation REST n'a été utilisée.

## Contexte de capture

- Projet Vikunja : `2`
- Tâche : `33`
- Dépôt : `rgrente/testvibe`
- Branche de travail : `agent/task-33`
- Le SHA exact du commit de livraison est fourni séparément par l'orchestrateur lors de l'appel MCP de soumission ; ce relevé ne le présente pas comme une sortie observée avant la création du commit.

## Limite de rôle

Le dépôt `rgrente/testvibe` ne contient pas le connecteur Hermes–Vikunja. Le rôle coder est limité à la lecture et à la validation de son contrat. Il ne doit ni déplacer la carte, ni raffiner, ni approuver, ni merger, ni clôturer sa propre tâche.

En conséquence, ce cycle n'a appelé aucune opération de déplacement de bucket, de refinement, d'approbation humaine, de verdict reviewer ou de merge. Les transitions humaines, les transitions invalides et le merge restent hors périmètre du contrat v2 courant et doivent être démontrés par une carte E2E opérateur distincte.

## Observations MCP réelles du cycle courant

### Lecture de la carte et bucket étendu

Appel effectué :

```text
mcp__vikunja__get_task(project_id=2, task_id=33)
```

Extrait exact des champs retournés par la réponse structurée :

```json
{
  "id": 33,
  "project_id": 2,
  "done": false,
  "bucket_id": 14,
  "buckets": [
    {"id": 14, "title": "Ready", "project_view_id": 10}
  ],
  "labels": null
}
```

Observation courante : la carte est dans la colonne `Ready`, déterminée par `buckets[0]` (`id=14`, vue `10`), elle n'est pas clôturée (`done=false`) et aucun label n'est retourné (`labels=null`). Le champ de colonne et les labels sont ainsi observés séparément.

### Validation du contrat v2

Appel effectué :

```text
mcp__vikunja__validate_for_execution(project_id=2, task_id=33)
```

Réponse structurée réellement retournée :

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

Observation courante : le connecteur considère le contrat exécutable (`executable=true`), sans raison bloquante (`reasons=[]`), avec `kind=code` et `schema_version=2`. La validation retourne `human_review=false`.

Aucune écriture n'a été effectuée par le coder pendant cette capture. Le SHA exact du commit livré sera transmis séparément à l'orchestrateur ; il ne doit pas être déduit d'une valeur inscrite dans ce fichier.

## Séparation colonne d'état / label `human:review`

- La colonne d'état est observée via `buckets`: la carte est actuellement dans `Ready`, `bucket_id=14`.
- La clôture est observée via `done=false`.
- Les labels sont observés via `labels=null`; aucun label `human:review` n'est présent dans la réponse de lecture.
- La validation de contrat retourne également `human_review=false`. Cette valeur de contrat ne remplace pas le champ de colonne et ne doit pas être interprétée comme une transition de workflow.
- Aucune opération n'a été appelée pour ajouter, retirer ou interpréter un label, et aucune transition humaine n'est présentée comme exécutée.

## Scénarios hors périmètre, non exécutés

Les éléments ci-dessous sont explicitement non démontrés ; ils ne constituent pas des réponses simulées ou des preuves négatives :

| Scénario | Appel dans ce cycle | Résultat | Motif |
|---|---|---|---|
| Parcours `Triage → Refinement → Awaiting Approval → Ready` | Aucun | Non exécuté | Relève d'un parcours orchestrator/refiner et d'une intervention humaine |
| Transitions invalides | Aucun | Non exécuté | Aucune opération générique autorisée au rôle coder pour provoquer ce scénario |
| `In Development → Review` | Aucun | Non exécuté | Nécessiterait l'implémentation soumise et l'action de revue autorisée |
| `Review → Done` et merge réel | Aucun | Non exécuté | Le coder ne peut ni approuver, ni merger, ni confirmer un merge |

Le parcours complet, l'approbation humaine, le refus de transitions invalides, la soumission en review et le merge réel ne sont donc pas affirmés comme démontrés par ce relevé. Ils doivent être pilotés et capturés par l'opérateur ou le rôle autorisé correspondant.

## Critères effectivement couverts

- Lecture MCP réelle de la carte avec bucket étendu `Ready` (`id=14`), `done=false` et `labels=null`.
- Validation MCP réelle du contrat v2 `kind=code`, `executable=true`, `reasons=[]` et `human_review=false`.
- Vérification documentaire explicite que la colonne d'état et le label `human:review` sont des autorités distinctes.
- Séparation explicite des scénarios hors scope, sans affirmation de transition humaine, de soumission MCP, de merge ou de passage vers `Done`.

## Vérifications du dépôt

Le dépôt ne définit pas de test automatisé ciblant ce fichier Markdown ; aucun test ciblé n'a été inventé. Les commandes demandées sont exécutées réellement dans le dépôt après la correction :

Résultats littéraux obtenus après cette correction :

```text
pnpm test       — OK : 111 tests (79 core + 32 web)
pnpm build      — OK : packages/db, packages/core et apps/web construits
pnpm lint       — OK : packages/db, packages/core et apps/web vérifiés
git diff --check — OK
```

Ces résultats couvrent les commandes demandées avant la création du commit de livraison. Aucun token, secret, changement de connecteur, changement de configuration, mutation REST ou code métier n'est inclus dans ce relevé.
