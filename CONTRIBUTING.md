# Contributing

## Commits and pull requests

Pull request titles must follow the [Conventional Commits](https://www.conventionalcommits.org/) format. The repository uses squash merges, so the pull request title becomes the commit message on `main`.

The release impact is determined automatically:

- `fix:` creates a patch release.
- `feat:` creates a minor release.
- `feat!:` or a `BREAKING CHANGE:` footer creates a major release.
- `chore:`, `docs:`, `refactor:`, `test:`, and `ci:` do not create a release by default.

Examples include `fix: preserve unknown GEDCOM fields` and `feat(tree): add compact view`. Keep the title focused on one change; add details and any `BREAKING CHANGE:` footer to the squash commit message when merging.

## Automated releases

This repository uses semantic-release rather than Changesets. Semantic-release fits the goal of releasing every eligible merge with no contributor-maintained metadata: the already-required Conventional Commit title is the single source for the version bump and changelog. Changesets would provide more editorial control, but each pull request would need another file that could drift from its title.

After the build, lint, and test checks pass on `main`, semantic-release updates `package.json`, `VERSION`, and `CHANGELOG.md`, creates a `v<version>` git tag, and pushes a release commit. The Docker job then checks out the updated `main` branch and publishes `ghcr.io/rgrente/testvibe:<version>` and `latest`. A non-release commit type intentionally does not rebuild an existing version tag.
