# AVICENNA

## Contributing: how to add code to this repo

A short checklist and commands for adding code from a new machine.

### 1) First-time SSH setup (GitHub/GitLab)
1. Generate a key (use ed25519 if available):
```bash
ssh-keygen -t ed25519 -C "your.email@example.com"
# or (if ed25519 not supported)
ssh-keygen -t rsa -b 4096 -C "your.email@example.com"
```
2. Start agent and add key:
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```
3. Copy public key and add to your Git account:
```bash
cat ~/.ssh/id_ed25519.pub
# copy the output and paste into GitHub/GitLab > SSH keys
```
4. Test:
```bash
ssh -T git@github.com
```

### 2) Basic git config (run once per machine)
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```
Name is arbitrary

## 3) Workflow: branch, work, push, PR
- Always work on a different branch than main for a change. Use descriptive names, e.g.:
    - feature/foo
    - fix/login-bug
    - chore/update-deps
```bash
git checkout -b feature/short-description
```
*-b* flag is for creating a new branch.

```bash
git checkout feature/short-description
```

without the flag it is for switching to the written branch for example.

- Keep your branch up to date with main before opening a PR:
```bash
git fetch origin
git rebase origin/main   # preferred for a clean history
# or: git merge origin/main
```
- Add, commit, and push:
```bash
git status  # Check the status of your working directory
git add .   # Add all changes to staging
# Alternatively, you can add specific files based on the output of git status with git add
git commit -m "Short: imperative summary
Longer description (optional)."

git push -u origin feature/short-description
```
If gives a connection refused error try this,
```bash
git remote set-url origin https://gitlab.ceng.metu.edu.tr/group14/avicenna.git
```
and try to push again.
## 4) Pull Request / Code Review
- Open a PR and:
    - Pick a clear title and description.
    - Link related issue(s).
    - Include testing steps and screenshots if relevant.
    - Assign one or more reviewers.
- **Do NOT merge your own PR. Assign someone else to review and merge.**
- Use draft PRs for work-in-progress.

### 5) Local check commands (use often)
- See changed files and working state:
```bash
git status
```

- Add a `.gitignore` file to your repository to specify files and directories that should not be tracked by Git. For example, if you have large datasets or local configurations, you can create a folder named `local*/` and place those files inside it. Like local_dataset etc.

```
local*/
*.log
```

3. Make sure to create the `local/` folder and move any files you want to keep out of the repository into it:
```bash
mkdir local
# Move files into local/
```
- This helps keep your repository clean and avoids pushing unnecessary files to GitHub.
- Inspect staged vs unstaged:
```bash
git diff        # unstaged
git diff --staged
```
- Review commits on branch:
```bash
git log --oneline --graph --decorate
```

### 6) Commit message guidelines
- Keep the first line short (<=72 chars), imperative tense:
    - "Add user profile endpoint"
    - "Fix typo in README"
- Add a body if more context is needed.

### 7) Tests, linting, CI
- Run project tests and linters locally before pushing.
- Fix warnings and failing tests; CI must pass before merge. (In our case for now only githubs merge clashes are checked.)

### 8) Safety and etiquette
- Avoid force-pushing to shared branches (main). If you must force-push, coordinate with the team.
- Keep commits focused and small where possible.
- Clean up stale branches after merge.

Follow these practices to keep the repository healthy and reviews efficient.