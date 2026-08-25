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

The release commit is the only intentional direct push to `main`. It authenticates with the `RELEASE_TOKEN` Actions secret described below; the default `GITHUB_TOKEN` cannot bypass the pull-request requirement.

### One-time release bootstrap (repository admin)

Before merging the semantic-release workflow for the first time, an administrator must tag the current pre-workflow `main` revision as `v0.1.0`. Without a matching existing tag, semantic-release treats the repository as unreleased, scans its entire history, and forces its first release to `1.0.0` even when commit analysis calls for a smaller bump. Run these commands while `main` still points to the code whose `package.json` and `VERSION` both contain `0.1.0`:

```sh
git fetch origin
git switch main
git pull --ff-only origin main
test "$(node -p 'require("./package.json").version')" = "0.1.0"
test "$(cat VERSION)" = "0.1.0"
git tag -a v0.1.0 -m "chore(release): 0.1.0 baseline"
git push origin v0.1.0
```

Verify with `git ls-remote --exit-code --tags origin refs/tags/v0.1.0` before merging the workflow. This baseline makes semantic-release analyze only later commits, so `fix` and `feat` produce the expected patch and minor releases and non-release commit types remain no-ops.

### Required checks on `main` (repository admin)

The workflow only gates merges when branch protection makes its jobs required. Before enabling protection, create a fine-grained personal access token owned by the repository administrator with access limited to this repository and **Contents: Read and write** permission. Store it as the `RELEASE_TOKEN` Actions repository secret. Do not grant it administration, workflows, packages, or access to other repositories. The release job is the only job that receives this token.

After the workflow has run on a pull request at least once (so GitHub knows the check names), protect `main`, require pull requests, require the branch to be up to date, and require both `build` and `lint-pr-title`. Administrator enforcement must remain disabled: GitHub only supports named pull-request bypass actors for organization-owned repositories, while this repository is user-owned. With enforcement disabled, the administrator-owned `RELEASE_TOKEN` can push the generated release commit; other collaborators must still use an approved pull request. The following command applies those settings while preserving the repository's existing squash-merge policy:

```sh
gh api --method PUT repos/rgrente/testvibe/branches/main/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["build", "lint-pr-title"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```

Alternatively, in GitHub open **Settings → Branches → Add branch protection rule**, target `main`, enable **Require a pull request before merging**, **Require status checks to pass before merging**, and **Require branches to be up to date before merging**, then select `build` and `lint-pr-title` as required checks. Leave **Do not allow bypassing the above settings** disabled so the release token can push. The pull-request workflow listens for title edits, so correcting an invalid title in the GitHub UI automatically reruns the title check.

After applying protection, verify the release path with an eligible `fix:` or `feat:` merge. The `release` job must create the release commit and tag, and the dependent `docker` job must publish the matching version. If `RELEASE_TOKEN` is missing, expired, or owned by an account that cannot bypass the rule, the release job fails instead of silently skipping the image.
