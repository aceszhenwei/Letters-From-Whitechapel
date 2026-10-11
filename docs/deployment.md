# Deployment

The game is published with GitHub Pages at **https://aceszhenwei.github.io/Letters-From-Whitechapel/**. It is a static site: the same files a contributor opens locally, with no build step, server or account. The optional playtest intake ([Automatic playtest collection](automatic-playtest-collection.md)) is a separate Cloudflare Worker, deployed by its own workflow; the Pages site stays static.

## How it works

`.github/workflows/pages.yml` (**Deploy to GitHub Pages**) runs on every push to `master`, and by hand:
1. **build:** installs the dependencies, runs the fast tests (`npm test`), and stages the site with `node tools/site/build.js _site`. If the repository variable `PLAYTEST_API_URL` is set, the build writes that public address into the staged `js/config.js`, which turns on Anonymous Gameplay Research; unset, the site sends nothing. Only `index.html`, `css/`, `js/`, `images/` and `fonts/` are copied: no research data, tests, tools, docs or experiment results. The script also checks that every local file `index.html` and the stylesheets refer to is present and none is referred to from the site root, which would break under the `/Letters-From-Whitechapel/` project path. A failing test or a missing file stops the release.
2. **deploy:** publishes the staged files with the official `actions/deploy-pages`. Only this job may write to Pages (`pages: write`, `id-token: write`); the workflow can otherwise only read the repository.

A newer push waits for a deployment in progress rather than cancelling it. Each run's result is on the repository's **Actions** tab, and the live address on its `github-pages` environment.

**Why a workflow rather than publishing the branch directly:** publishing `master` as it is would also put the research data, experiment results, tests and tools online (tens of megabytes nobody plays), and wouldn't stop a commit that fails the tests. The workflow publishes only the game, after the tests.

**One-time setting:** in the repository's **Settings → Pages**, **Build and deployment → Source** must be **GitHub Actions**. The workflow can't change that setting itself.

## Redeploying

- **After a failed release:** open the failed run on the **Actions** tab. If the tests or the site check failed, fix the cause on `master`; the push deploys again. If the failure was GitHub's (a deployment that timed out, for example), choose **Re-run failed jobs**.
- **The same commit again:** **Actions → Deploy to GitHub Pages → Run workflow** on `master`.
- **Going back to an earlier version:** revert the commit on `master`; the push deploys the reverted game.

## Releases and the online game

Releases ([Releasing](releasing.md)) are tags on `master` with notes; they don't deploy anything. The online game always follows `master`: each merged pull request is published, release or not. `release.yml` only creates the GitHub Release, and `pages.yml` doesn't run on tags.

## Running locally

```
open index.html                 # or double-click it: works from the folder on a computer
npx serve .                     # or python3 -m http.server: the same as the hosted site, at http://localhost:...
npm run site                    # stage the site in _site/ exactly as the workflow does, and check it
```

## Limitations

- **Open the game from the folder or a web address, not as a single file.** A phone that opens a downloaded `index.html` (an address beginning `content://`) can't load the scripts, stylesheet and map next to it, and shows an unstyled page. Use the hosted address instead.
- **Fonts:** the titles and text use Google Fonts. Without a connection to fonts.googleapis.com the game still works, in the browser's own fonts.
- **Saved choices** (the difficulty) are kept in the browser's local storage, per browser and per site: the hosted game and a local copy remember separately. Private windows forget them.
- **Game logs** are made and saved in the browser ([Game records](game-records.md)); GitHub Pages never receives them. If the playtest intake is configured, finished games are also submitted to it unless the player opts out ([Automatic playtest collection](automatic-playtest-collection.md)).

## The playtest intake Worker

Deployed separately from Pages, by hand: **Actions → Deploy playtest Worker → Run workflow** (`deploy`, `pause` or `resume`), with the Cloudflare secrets described in [Automatic playtest collection §11](automatic-playtest-collection.md#11-owner-setup). Pull requests that touch `worker/` get a bundling check. Records imported from it into `research/human-playtests/` don't redeploy Pages (`pages.yml` ignores that folder).
- **Browsers:** current desktop and mobile versions of Chrome, Edge, Firefox and Safari. The page uses no features that need a server.
