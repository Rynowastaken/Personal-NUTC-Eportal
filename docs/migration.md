# Migrating from eportal-bot to Personal-NUTC-Eportal

The GitHub repository is now **[Rynowastaken/Personal-NUTC-Eportal](https://github.com/Rynowastaken/Personal-NUTC-Eportal)**. The app still runs on port `4174` by default. This guide covers existing local checkouts, persistent data, Linux systemd deployments, and userscript installations.

## What changed

| Item | Previous installation | New installation |
| --- | --- | --- |
| GitHub repository | `Rynowastaken/eportal-bot` | `Rynowastaken/Personal-NUTC-Eportal` |
| Default directory created by `git clone` | `eportal-bot/` | `Personal-NUTC-Eportal/` |
| npm package name | `eportal-bot` | `personal-nutc-eportal` |
| systemd unit | `eportal-bot.service` | `personal-nutc-eportal.service` |
| systemd environment file | `/etc/eportal-bot/eportal.env` | `/etc/personal-nutc-eportal/eportal.env` |
| Example systemd unit | `deploy/no-tunnel/eportal-bot.service.example` | `deploy/no-tunnel/personal-nutc-eportal.service.example` |

**Unchanged:** the application port, environment variable names, `.eportal-profile/` (logged-in browser state), `data/` (local preferences/uploads), `.deploy/` (generated private deployment bundle), Cloudflare Access settings, and Caddy's reverse-proxy destination. **Do not rename or commit these state directories.**

GitHub usually redirects the old repository URL, but update `origin`, scripts, bookmarks, and userscript URLs to the new address rather than relying on redirects.

## 1. Update an existing checkout (recommended)

Keep the same working directory: its name **does not have to change**, and keeping it avoids breaking absolute paths in systemd units. On a server, stop the running service first (see step 3). On a local machine, stop `npm start` before updating.

```bash
cd /path/to/existing/checkout
git status --short             # commit/stash your changes before pulling
git remote set-url origin https://github.com/Rynowastaken/Personal-NUTC-Eportal.git
git fetch origin
git pull --ff-only origin main
npm install
npm run check
npm test
npm run doctor
```

You can continue to use the same directory, even if it is still named `eportal-bot`. The Node app locates its browser profile and `data/` relative to the project root, not the repository name.

If `git pull --ff-only` refuses to proceed, resolve your local commits/changes first; **do not delete the checkout** as a shortcut.

## 2. Moving to a fresh clone or renaming the directory (optional)

A new clone will **not** automatically contain your private files, because they are ignored by Git. Stop any running app before moving/copying the browser profile. Copy these directories **from your old checkout to the root of the new checkout**, if present:

```bash
git clone https://github.com/Rynowastaken/Personal-NUTC-Eportal.git
# Stop the app before copying persistent state!
cp -a /path/to/old/checkout/.eportal-profile ./Personal-NUTC-Eportal/
cp -a /path/to/old/checkout/data ./Personal-NUTC-Eportal/
cd Personal-NUTC-Eportal
npm install
npm run install-browser
npm run doctor
```

Skip a `cp` command if that directory does not exist. Preserve ownership and permissions, particularly for `.eportal-profile/`, which contains authenticated session credentials. Do not upload or commit it, the `data/` directory, or secrets under `.deploy/`. If you change the deployment directory, update both `WorkingDirectory` and `ExecStart` in your systemd unit (or regenerate the unit with `npm run deploy:configure`).

## 3. Migrate an existing Linux systemd deployment

This section assumes your existing service is named `eportal-bot.service` and currently reads `/etc/eportal-bot/eportal.env`. If you used custom paths, adapt them. Run the Git update from step 1 against the **existing checkout**; do **not** rename/move it at the same time.

First, back up your private deployment configuration and the checkout's `.eportal-profile/` and `data/` to a secure location. Then stop and disable the old unit to avoid two Node processes competing for port `4174` or the Chromium profile:

```bash
sudo systemctl disable --now eportal-bot.service
sudo install -d -m 700 /etc/personal-nutc-eportal
sudo install -m 600 /etc/eportal-bot/eportal.env /etc/personal-nutc-eportal/eportal.env
sudo cp /etc/systemd/system/eportal-bot.service /etc/systemd/system/personal-nutc-eportal.service
sudo sed -i 's#/etc/eportal-bot/eportal.env#/etc/personal-nutc-eportal/eportal.env#g' /etc/systemd/system/personal-nutc-eportal.service
```

Open the new `/etc/systemd/system/personal-nutc-eportal.service` and confirm `WorkingDirectory` and `ExecStart` still point to your actual checkout/Node binary. If your previous unit did not come from the bundled examples, also verify its `EnvironmentFile`, `User`, and `Group` entries.

Once you've pulled the new code and checked the unit:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now personal-nutc-eportal.service
sudo systemctl status personal-nutc-eportal.service
```

Check `http://127.0.0.1:4174/login` locally and then your normal Cloudflare-protected hostname in a browser. Verify that the existing account session and preferences appear correctly. The Cloudflare DNS, Access policy, and Caddy configuration do **not** need changing solely because the GitHub repository was renamed.

For a **new** Linux deployment, use `npm run deploy:configure` as described in [Cloudflare Access deployment](cloudflare-access.md); it now generates `personal-nutc-eportal.service` and installs the environment file in `/etc/personal-nutc-eportal/`. Be aware that `sudo npm run deploy:configure -- --install` can also replace the active Caddyfile and environment settings, so review its generated files and backups first.

**Rollback:** If the new service fails, stop/disable `personal-nutc-eportal.service` and re-enable `eportal-bot.service` while retaining the original checkout path and old environment file. If you already updated the checkout to code requiring changed configuration, restore your tested code version before rollback. Keep the old unit/environment file until the new installation has been verified.

## 4. Userscript update

The userscript's `@namespace`, `@updateURL` and `@downloadURL` now point to this repository; its version was increased to `0.4.1`.

New source:

```text
https://raw.githubusercontent.com/Rynowastaken/Personal-NUTC-Eportal/main/public/userscript/nutc-portal.user.js
```

Open that URL in your userscript manager to install/update the script. Because the namespace changed, some managers may treat it as a **different** script. After installation, ensure only one **NUTC Portal Bridge** script is enabled for `https://eportal.nutc.edu.tw/*`; disable/remove the old copy if it was duplicated. The separate server-side `.eportal-profile/` state does not need reinstalling.

## 5. Verify migration

- `git remote -v` shows `Rynowastaken/Personal-NUTC-Eportal.git`.
- `npm run check`, `npm test`, and `npm run doctor` pass in the updated checkout.
- If using systemd, `personal-nutc-eportal.service` is active and `eportal-bot.service` is inactive.
- Your login state and dashboard preferences survived the update; the userscript manager has just one enabled bridge script.
- No `.eportal-profile/`, `data/`, or `.deploy/` secrets were committed, uploaded, or made public.

Historical references to `eportal-bot` in this migration document are intentional so existing installations can be identified and migrated safely.
