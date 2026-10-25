# Upload SwingLab to GitHub

Prepared 25 October 2026. No Git repository existed in this folder when this guide was written. These are instructions for you; no repository has been created or pushed by the assistant.

## 1. Create an empty repository

Sign in to GitHub, choose New repository, name it `swinglab` (or your preferred name), and select Private. Leave README, .gitignore and license initialization unchecked because this project already has files. Copy its HTTPS URL.

## 2. Initialize locally

Open PowerShell:

```powershell
Set-Location D:\Dev\stock
git --version
git init -b main
```

If Git is unavailable, install Git for Windows and reopen the terminal. If Git requests commit identity later, set your own name and GitHub email using `git config user.name` and `git config user.email` inside this repository.

## 3. Verify exclusions before staging

```powershell
git check-ignore .env data/arus.db docs/arjum-samples.json docs/arjum-extra-samples.json node_modules/
git status --short
```

The first command should list all five ignored paths. Stop if .env is not ignored. Existing .gitignore also excludes generated build output and local reports. Only .env.example, containing blank configuration placeholders, should be committed.

## 4. Review and commit

```powershell
git add .
git diff --cached --stat
git diff --cached --name-only
git ls-files .env data/ docs/arjum-samples.json docs/arjum-extra-samples.json
git diff --cached
```

The `git ls-files` check should print nothing. Review staged content for personal information or credentials. Do not paste staged private content into chat. If an ignored private file appears, unstage it with `git rm --cached -- PATH` and fix the exclusion before committing. Do not use deletion commands on your working files.

```powershell
git commit -m "Initial SwingLab research prototype"
```

## 5. Connect and upload

Replace YOUR_USERNAME and REPOSITORY with the actual repository details:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/REPOSITORY.git
git push -u origin main
```

Complete GitHub authentication when prompted. Never embed an API key or GitHub token in the remote URL. Open the repository in your browser and verify the code and docs appear, while .env, data and raw provider snapshots do not.

## Future updates

```powershell
git status
git add .
git diff --cached
git commit -m "Describe the change"
git push
```

Review every staged update before committing. If a key is ever uploaded, revoke/rotate it; deleting it in a later commit does not remove earlier history.

## What GitHub does not provide

Uploading source does not deploy the app or keep your local process running. A fresh checkout needs Node 22.18+ or 24, `npm ci`, and its own private .env. Raw market snapshots, the database and backtest report are deliberately excluded. Run the validation acquisition script with your key to recreate snapshots, then `npm run backtest`. A snapshotless app can acquire data through its bounded refresh.

Vercel is a separate step requiring server-side ARJUM_API_KEY, a hosted DATABASE_URL and DATABASE_AUTH_TOKEN, and APP_PASSWORD. Do not use a local SQLite file on Vercel. Production financial readiness is separate from successful hosting.

Official reference: https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github
