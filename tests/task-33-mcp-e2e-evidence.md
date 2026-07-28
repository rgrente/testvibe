# Tâche #33 — preuves E2E MCP Vikunja

Ce document consigne uniquement des observations obtenues pendant ce cycle. Il ne redéfinit pas le workflow columns-only et ne fabrique aucune sortie MCP. Aucune mutation REST n'a été utilisée.

## Contexte de capture

- Projet Vikunja : `2`
- Tâche : `33`
- Dépôt : `rgrente/testvibe`
- Branche de travail : `agent/task-33`
- Révision présente avant cette correction : `e159757fe30c0c553d781a02fb02a89e77ed99cf` (sortie réelle de `git rev-parse HEAD` avant modification)
- Le SHA du nouveau commit de livraison sera vérifié après le commit et fourni par l'orchestrateur lors de la soumission MCP. Il n'est pas présenté ici comme une sortie déjà observée.

## Interfaces examinées et limite de rôle

Le dépôt `rgrente/testvibe` ne contient pas le connecteur Hermes–Vikunja. L'implémentation locale du connecteur, examinée séparément dans `/opt/data/vikunja-hermes-connector`, expose des opérations spécialisées (`start_refinement`, `submit_refinement`, `request_human_input`, `submit_for_review`, `submit_review`, `confirm_merge`) et applique des gardes de rôle. La configuration de cette session est celle du coder : le coder ne doit ni raffiner, ni approuver, ni merger, ni clôturer sa propre tâche.

En conséquence, ce cycle n'a appelé aucune opération de déplacement de bucket, de refinement, d'approbation humaine, de verdict reviewer ou de merge. Il n'existe pas, dans les outils autorisés à ce handoff, d'opération générique permettant de déplacer arbitrairement la carte ou de rejouer une transition invalide sans franchir les responsabilités d'un autre rôle.

## Scénario observé : lecture réelle puis validation coder

### État initial et bucket

Appel MCP réel :

```text
mcp__vikunja__get_task(project_id=2, task_id=33)
```

Extrait exact des champs retournés par la réponse structurée :

```json
{
  "id": 33,
  "project_id": 2,
  "done": false,
  "bucket_id": 15,
  "buckets": [
    {"id": 15, "title": "In Development", "project_view_id": 10}
  ],
  "labels": null
}
```

État initial réellement observé : `In Development` (`bucket_id=15`), tâche non clôturée (`done=false`), aucun label retourné (`labels=null`).

### Appel MCP effectué et réponse

Appel MCP réel :

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

État final de ce scénario : aucune écriture n'a été effectuée ; la carte reste donc `In Development` (`bucket_id=15`). Le résultat prouve seulement que le contrat code courant est exécutable et que le label `human:review` est absent selon le champ `human_review=false` de la validation. Il ne prouve pas un déplacement de colonne.

## Scénarios demandés mais non exécutés par ce rôle

Les éléments suivants ne sont pas des preuves négatives ni des sorties inventées : ils identifient précisément les étapes qui n'ont pas été appelées.

| Scénario | État initial/final observé | Appel MCP | Résultat réel | Motif de non-exécution |
|---|---|---|---|---|
| `Triage → Refinement` | Aucun état Triage n'a été préparé pour cette capture | Aucun appel de déplacement autorisé | Aucune réponse de transition disponible | `start_refinement` relève du rôle orchestrator/refiner, pas du coder |
| `Refinement → Awaiting Approval` | Aucun état Refinement n'a été préparé | Aucun appel de soumission de refinement | Aucune réponse de transition disponible | `submit_refinement` relève du parcours orchestrator/refiner |
| `Awaiting Approval → Ready` | Aucune carte en attente d'approbation n'a été préparée | Aucun appel d'approbation humaine | Aucune réponse de transition disponible | l'approbation doit être effectuée par un opérateur/orchestrator distinct |
| Transition invalide | Aucun essai de transition n'a été lancé | Aucun appel | Aucune erreur réelle à rapporter | le rôle coder n'expose pas d'opération générique de déplacement et ne doit pas appeler les opérations d'un autre rôle |
| `Review → Done` | La carte n'est pas en Done et aucun merge n'est disponible | Aucun `submit_review`/`confirm_merge` | Aucune réponse de clôture disponible | le coder ne peut ni approuver, ni confirmer un merge, ni marquer Done |

Le parcours complet `Triage → Refinement → Awaiting Approval → Ready → In Development → Review → Done`, l'approbation humaine et le refus de transitions invalides restent donc **non démontrés par ce rôle dans ce commit**. Les présenter comme exécutés serait une preuve fabriquée.

## Critères effectivement démontrés

- Lecture de l'état par le connecteur MCP réel, avec bucket étendu `In Development` (`15`).
- Validation du contrat v2 réel par MCP : `executable=true`, `reasons=[]`, `kind=code`.
- Absence de `human:review` dans la validation réelle (`human_review=false`) et absence de labels dans la lecture (`labels=null`).

## Critères non démontrés et action requise

- Parcours complet jusqu'à `Review`/`Done` : non démontré.
- Transitions invalides effectivement refusées avec une erreur réelle : non démontré.
- Approbation humaine vers `Ready` : non démontrée.

Pour obtenir ces preuves sans contourner les contrôles, un orchestrator/refiner/reviewer autorisé doit piloter une carte de test, capturer un `get_task` avant et après chaque écriture, et rapporter les erreurs réelles des transitions invalides. Le coder peut ensuite reprendre uniquement l'étape qui lui est attribuée. Aucun merge, approve, Done ou soumission MCP n'a été effectué par ce cycle.

## Vérifications dépôt

Le dépôt ne définit pas de test automatisé ciblant ce fichier Markdown ; aucune commande de test ciblé n'a donc été inventée. Les commandes demandées ont été exécutées réellement dans le dépôt :

```text
pnpm test       — OK : 111 tests (79 core + 32 web)
pnpm build      — OK : packages/db, packages/core et apps/web construits
pnpm lint       — OK : packages/db, packages/core et apps/web vérifiés

git diff --check — OK
```

`pnpm` était absent au premier appel (`pnpm: command not found`), puis a été installé dans le préfixe utilisateur avec `pnpm@11.17.0`; les quatre vérifications ci-dessus sont celles exécutées après cette installation. Aucun token, secret, changement de connecteur, changement de configuration, mutation REST ou code métier n'est inclus dans ce relevé.
