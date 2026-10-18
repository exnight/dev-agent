# Update Pinned Submodules

Run from the repository root.

## 1. Check for Local Changes

```bash
git submodule foreach --recursive 'git status --short'
```

Commit or stash changes inside each submodule before continuing.

## 2. Select New Versions

Replace each placeholder with an upstream tag or full commit SHA. Run the commands only for the submodules you want to update.

```bash
git submodule update --init --recursive

git -C vendor/garden-skills fetch origin --tags
git -C vendor/garden-skills switch --detach <garden-tag-or-commit>

git -C vendor/impeccable fetch origin --tags
git -C vendor/impeccable switch --detach <impeccable-tag-or-commit>
```

Update nested submodules without resetting the selected versions:

```bash
git -C vendor/garden-skills submodule update --init --recursive
git -C vendor/impeccable submodule update --init --recursive
```

Do not run the parent repository's `git submodule update` before staging the new pins. It would restore the versions recorded in the index.

## 3. Review and Commit

Review the selected changes and check that the skills still work.

```bash
git diff --submodule=log

git add vendor/garden-skills vendor/impeccable
git diff --cached --submodule=log

git commit -m "chore: update pinned vendor skills"
git push
```

Stage only the submodules you intend to update. The parent repository records their exact commits, even when you select tags.

Run `/reload` in Pi. No image rebuild is needed for the mounted skills.

## 4. Update the Other Machine

```bash
git pull
git submodule update --init --recursive
```
