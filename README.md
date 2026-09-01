# TestVibe — arbre généalogique personnel

TestVibe est une application web auto-hébergeable pour consulter et administrer
une généalogie familiale. Le monorepo utilise Next.js 16, React 19, TypeScript,
Drizzle ORM et SQLite/libSQL.

## Fonctionnalités

- arbre interactif et liste des personnes, recherche et fiches individuelles ;
- carte des lieux, timeline familiale, anniversaires et statistiques ;
- administration des personnes, unions, filiations, événements et médias ;
- import et export GEDCOM 5.5.1, et sauvegarde exhaustive de l'instance ;
- géocodage des lieux via Nominatim ou Photon.

Les écrans et actions d'administration sont protégés par une session serveur
fondée sur le secret configuré. Ce mécanisme convient à un usage personnel
maîtrisé, mais ne constitue pas un système complet de comptes utilisateurs.
Les requêtes de géocodage transmettent le lieu recherché au fournisseur externe.

## Architecture

```text
apps/web       Application Next.js (pages, actions serveur et routes API)
packages/core  Règles métier, projections, GEDCOM, arbre et statistiques
packages/db    Schéma et accès SQLite/libSQL avec Drizzle ORM
```

![Architecture applicative : du navigateur aux données et services externes](docs/architecture/system-architecture.svg)

[Ouvrir la vue HTML de l'architecture](docs/architecture/system-architecture.html)

![Flux principaux : consultation, administration et échanges de fichiers](docs/architecture/main-data-flows.svg)

[Ouvrir la vue HTML des flux](docs/architecture/main-data-flows.html)

La base SQLite/libSQL contient les données métier. Les médias sont stockés dans
un répertoire distinct sur le système de fichiers.

## Démarrage local

Prérequis : Node.js 24 et pnpm 11.17.0 via Corepack. Les versions de référence
sont déclarées dans `.nvmrc` et `package.json`.

```bash
nvm install
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

L'application est ensuite disponible sur `http://localhost:3000`.

## Configuration

Définissez les variables côté serveur dans votre environnement, sans les
committer :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | URL libSQL ou chemin du fichier SQLite persistant. |
| `ADMIN_SECRET` | Secret requis pour ouvrir la session d'administration. |
| `ADMIN_ORIGIN` | Origine canonique complète (par exemple `https://famille.example`) autorisée pour les mutations admin. |
| `ADMIN_TRUSTED_PROXY` | Mettre à `1` uniquement si le proxy frontal supprime les en-têtes d'adresse fournis par le client puis renseigne `X-Forwarded-For`; sans cette frontière explicite, le login admin échoue fermé. |
| `UPLOAD_DIR` | Répertoire persistant des photos et documents. |
| `BACKUP_DIR` | Répertoire persistant des sauvegardes de sécurité créées avant restauration (par défaut `backups`). |
| `FAMILY_TIME_ZONE` | Fuseau IANA utilisé pour les dates familiales. |

Sans configuration explicite, le développement local utilise une base
`file:./local.db`, un répertoire `uploads` et le fuseau `Europe/Paris`. Aucun
secret d'administration n'est fourni par défaut.

## Sauvegarde complète et GEDCOM

Le GEDCOM 5.5.1 reste un format d'échange généalogique : il ne contient pas
toutes les propriétés propres à TestVibe ni les fichiers médias. L'export
authentifié `GET /admin/backup/export` produit au contraire une archive JSON
portable contenant les six tables généalogiques, les octets médias et un
manifeste avec compteurs, tailles et sommes SHA-256. Cette archive contient des
données familiales potentiellement confidentielles ; stockez-la et transmettez-la
comme un document sensible.

La route authentifiée `POST /admin/backup/restore` reçoit l'archive en
`multipart/form-data`. Le mode `validate` vérifie sans écrire. Le mode `replace`
exige le champ `confirm=REPLACE`, crée d'abord une sauvegarde de sécurité dans
`BACKUP_DIR`, prépare les médias à part puis remplace données et fichiers avec
rollback en cas d'échec. Le format courant est `1.1` : les versions mineures
antérieures de la majeure 1 sont acceptées, les versions futures ou d'une autre
majeure sont refusées. Conservez la sauvegarde de sécurité jusqu'à vérification
manuelle de l'instance restaurée.

## Qualité

Après l'installation figée, exécutez les contrôles dans cet ordre :

```bash
pnpm build
pnpm lint
pnpm test
```

## Déploiement

Le `Dockerfile` construit l'application Next.js et démarre `next start` sur le
port 3000. La CI construit les images de pull request et publie l'image de
production dans GitHub Container Registry (GHCR) après une release sur `main`.

Pour conserver les données entre les conteneurs, fournissez `DATABASE_URL` et
montez les emplacements de la base et de `UPLOAD_DIR` sur des volumes
persistants. Les migrations, sauvegardes, secrets, accès réseau et mises à jour
restent sous la responsabilité de l'opérateur.

## Limites

TestVibe vise une instance familiale personnelle : il n'offre ni gestion
multi-comptes ni synchronisation avec un service généalogique tiers. SQLite et
le stockage local des médias impliquent une stratégie de sauvegarde propre à
l'instance. Le rendu des diagrammes peut charger des polices Google externes.
