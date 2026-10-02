# Releases

Versions are cut automatically from [Conventional Commits](https://www.conventionalcommits.org/):

- `fix:` → patch bump
- `feat:` → minor bump
- `feat!:` / `fix!:` / `BREAKING CHANGE:` → major bump

When you push to `main`, [release-please](https://github.com/googleapis/release-please) opens (or updates) a Release PR with the version bump and changelog. Merging that PR tags `vX.Y.Z`, creates the GitHub release, and triggers the macOS build that uploads the `.dmg` and `.app.tar.gz` to the release.

For fully hands-off releases:

1. In Settings → Actions → General → Workflow permissions, enable **Allow GitHub Actions to create and approve pull requests**.
2. In Settings → General → Pull Requests, enable **Allow auto-merge**.
3. Set a repository secret named `RELEASE_PLEASE_TOKEN` with a classic [Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) that has `repo` scope.

Without the PAT, merge the Release PR by hand; the release and build still happen automatically.

The app is ad-hoc signed, not notarized. On first launch, macOS blocks it: open System Settings → Privacy & Security and click **Open Anyway** next to Edytka.
