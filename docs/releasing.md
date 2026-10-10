# Releasing

How versions are numbered and how a release is made. A release is a tag on `master` and a GitHub Release with notes. There is no release branch, package, installer or build: GitHub's source archives are the downloads, and the online game is published from `master` by GitHub Pages ([Deployment](deployment.md)), independently of releases.

## Versioning

Versions are `MAJOR.MINOR.PATCH` ([Semantic Versioning](https://semver.org/)), tagged `vMAJOR.MINOR.PATCH`. For this game:

| Release | Raise | When | Examples |
|---|---|---|---|
| **Patch** | `1.0.0` → `1.0.1` | Bug fixes only: no new feature, and no change to the rules or to how an AI plays except to fix a defect | A softlock fixed, a wrong log message, a layout bug on a phone, a documentation correction |
| **Minor** | `1.0.1` → `1.1.0` | New features that keep everything that worked: new options, levels, tools or interface features; a new AI offered alongside the old ones | A new difficulty level, an optional rule that is off by default, a new export |
| **Major** | `1.4.2` → `2.0.0` | Changes that break what players or tools rely on | The default rules change, saved game records stop replaying (a new `schemaVersion` or rule set without a reader for the old one), a level is removed or now plays a different AI |

**How to choose:**
- When in doubt between two kinds, take the larger.
- A release with both features and fixes is a minor release.
- Research that changes no game behaviour (a new report, a study's scripts) needs no release of its own. It goes into the next one.

**Pre-releases** for testing a release before it is final are `vX.Y.Z-rc.1`, `-rc.2` …; the release workflow marks them as pre-releases, never as the latest.

**What the version is tied to:**
- `package.json`'s `version` is the version. `js/core/record.js`'s `appVersion` must equal it (a test checks), because every exported game record carries it.
- The record's `schemaVersion` and `ruleset.id` are separate: they change only when the record format or the rules and map change ([Game records §8](game-records.md#8-versions-and-compatibility)), and such a change is usually a major release.

## The changelog

[CHANGELOG.md](../CHANGELOG.md) lists every change, newest first:
- **Every pull request** adds its entry under **Unreleased** ([Contributing](contributing.md)).
- **At a release**, the Unreleased entries move under a new heading `## vX.Y.Z (YYYY-MM-DD)`, with a short summary of the highlights, and Unreleased starts again empty ("Nothing yet.").

## Making a release

1. **Prepare it in a pull request** to `master`:
   - Move the changelog's Unreleased entries under the new version and date.
   - Set the new version in `package.json` (and `package-lock.json`, by `npm version X.Y.Z --no-git-tag-version`) and in `js/core/record.js` (`appVersion`).
   - Write the release notes, `docs/releases/vX.Y.Z.md`: what a player gets, in a few short sections, and links to the changelog and documentation at the tag (`.../blob/vX.Y.Z/...`).
   - Update version references in the README if the release changes what it says.
2. **Check:** CI passes (`npm test`, `npm run test:smoke`), and the release notes and changelog read correctly. Merge the pull request.
3. **Tag the merge commit on `master`** with an annotated tag, and push the tag:
   ```
   git fetch origin master
   git tag -a vX.Y.Z -m "Letters From Whitechapel vX.Y.Z" origin/master
   git push origin vX.Y.Z
   ```
   Or run **Actions › Release › Run workflow** with the version: it tags the head of `master` the same way.
4. **The release workflow** (`.github/workflows/release.yml`) then:
   - checks that the tag matches `package.json` and that the notes exist;
   - runs the tests on the tagged commit;
   - publishes the GitHub Release from `docs/releases/vX.Y.Z.md`, marked as the latest release.

   If a step fails, fix it on `master` in a new pull request. Never move a published tag: release the fix as the next patch.
5. **After the release:** start the next version's work under Unreleased. The version in `package.json` stays at the released one until the next release's pull request raises it.

## Releases

| Version | Date | Notes |
|---|---|---|
| v1.0.0 | 2026-10-10 | [Release notes](releases/v1.0.0.md): the first formal release |
