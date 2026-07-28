# Tâche #33 — preuves MCP Vikunja accessibles au coder

Ce relevé contient uniquement les observations MCP obtenues pendant le cycle courant et les contrôles locaux exécutés dans ce dépôt. Il ne redéfinit pas le workflow columns-only, ne simule aucune transition et ne contient aucune sortie MCP ou GitHub inventée. Aucune mutation REST n'a été utilisée.

## Contexte de capture

- Projet Vikunja : `2`
- Tâche : `33`
- Dépôt : `rgrente/testvibe`
- Branche de travail : `agent/task-33`
- État MCP observé avant la création de ce commit : `In Development` (`bucket_id=15`)
- Le SHA exact du commit de livraison est fourni séparément par l'orchestrateur lors de l'appel MCP de soumission ; ce relevé ne le présente pas comme une sortie observée avant la création du commit.

## Limite de rôle et retour reviewer #62

Le dépôt `rgrente/testvibe` ne contient pas le connecteur Hermes–Vikunja. Le rôle coder est limité à la lecture et à la validation de son contrat. Il ne doit ni déplacer la carte, ni raffiner, ni approuver, ni merger, ni clôturer sa propre tâche.

Le retour reviewer #62 a signalé que son environnement ne disposait ni de `gh`, ni de `GITHUB_TOKEN`, ni de credential GitHub et ne pouvait donc pas vérifier indépendamment le dépôt, le commit ou la CI. Cette correction ne prétend pas résoudre l'accès de l'environnement reviewer : la branche, le SHA livré et les checks GitHub/CI externes doivent être vérifiés indépendamment par le reviewer avec son propre accès GitHub. Aucune sortie GitHub/CI externe non observée dans le cycle courant n'est reproduite ici.

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
  "bucket_id": 15,
  "buckets": [
    {"id": 15, "title": "In Development", "project_view_id": 10}
  ],
  "labels": null
}
```

Observation courante : la carte est dans la colonne `In Development`, déterminée par `buckets[0]` (`id=15`, vue `10`), elle n'est pas clôturée (`done=false`) et aucun label n'est retourné (`labels=null`). Le champ de colonne et les labels sont ainsi observés séparément.

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

- La colonne d'état est observée via `buckets` : la carte est actuellement dans `In Development`, `bucket_id=15`.
- La clôture est observée via `done=false`.
- Les labels sont observés via `labels=null` ; aucun label `human:review` n'est présent dans la réponse de lecture.
- La validation de contrat retourne également `human_review=false`. Cette valeur de contrat ne remplace pas le champ de colonne et ne doit pas être interprétée comme une transition de workflow.
- Aucune opération n'a été appelée pour ajouter, retirer ou interpréter un label, et aucune transition humaine n'est présentée comme exécutée.

## Vérifications GitHub externes — à faire par le reviewer

Les vérifications suivantes ne sont pas revendiquées comme exécutées dans ce relevé. Le reviewer doit les effectuer avec un accès GitHub fonctionnel, sur le SHA exact fourni séparément par `submit_for_review` :

- confirmer que `agent/task-33` pointe exactement vers le SHA soumis ;
- vérifier l'auteur et le parent du commit ;
- vérifier la CI GitHub pour ce `head_sha` jusqu'à un état `completed/success` ;
- comparer le diff du SHA soumis à la branche de base et confirmer qu'il est limité à ce relevé.

Le message de soumission MCP et la vérification GitHub/CI indépendante du reviewer sont les autorités pour ces éléments externes. Ce fichier ne contient aucun résultat GitHub/CI supposé, attendu ou fabriqué.

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

- Lecture MCP réelle de la carte avec bucket étendu `In Development` (`id=15`), `done=false` et `labels=null`.
- Validation MCP réelle du contrat v2 `kind=code`, `executable=true`, `reasons=[]` et `human_review=false`.
- Vérification documentaire explicite que la colonne d'état et le label `human:review` sont des autorités distinctes.
- Séparation explicite des scénarios hors scope, sans affirmation de transition humaine, de soumission MCP, de merge ou de passage vers `Done`.
- Les vérifications GitHub/CI externes sont explicitement réservées au reviewer disposant de l'accès nécessaire ; aucune sortie externe n'est inventée.

## Vérifications du dépôt

Le dépôt ne définit pas de test automatisé ciblant ce fichier Markdown ; aucun test ciblé n'a été inventé. Les commandes demandées sont exécutées réellement dans le dépôt après la correction :

Résultats littéraux obtenus avant la création du commit de livraison :

```text
pnpm test       — OK : 111 tests (79 core + 32 web)
pnpm build      — OK : packages/db, packages/core et apps/web construits
pnpm lint       — OK : packages/db, packages/core et apps/web vérifiés
git diff --check — OK
```

Ces résultats couvrent les commandes demandées avant la création du commit de livraison. La vérification `git ls-remote` de la branche après push est remise séparément à l'orchestrateur avec le SHA exact. Aucun token, secret, changement de connecteur, changement de configuration, mutation REST ou code métier n'est inclus dans ce relevé.
