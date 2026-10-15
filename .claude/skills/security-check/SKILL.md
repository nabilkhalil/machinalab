---
name: security-check
description: Security review checklist for MachinaLab as a static GitHub Pages app handling student notes — XSS in template rendering, localStorage tampering, CSV formula injection, CSP, deploy artifact scope, and supply chain. Use before every release and after any change to HTML templates, storage, export, index.html, or the deploy workflow.
---

# Security check

Threat model: a static site with no server and no accounts. The real risks are:
(1) XSS through values rendered into `innerHTML`, sourced from `localStorage` or imported
files; (2) **every project site under `<user>.github.io` shares one origin**, so other pages
by the same owner can read and write this app's `localStorage`; (3) CSV formula injection when a
lecturer opens student exports in Excel; (4) publishing files that were never meant to be public;
(5) compromised third-party actions or scripts.

## Checklist (run each; report pass/fail with evidence)

1. **Template escaping.** Grep every `${` inside template literals that build HTML.
   Each interpolation must be either a literal from code, or wrapped in `esc()`, or a
   number passed through `fmt()`, which returns a string with no markup. Values read from state
   (including "numbers") must be escaped, because stored state may be a string.
   `grep -nE '\$\{[^}]*state\.' site/js/*.js`
2. **No dangerous sinks.** No `eval`, `new Function`, `setTimeout(string)`,
   `document.write`, `insertAdjacentHTML` with unescaped data, or `javascript:` URLs.
3. **Stored state sanitised.** Loading goes through `validate.js` sanitise (see the
   `input-validation` skill). Test this: put `{"liveSpeed":"\"><img src=x onerror=alert(1)>"}`
   in storage, reload, and confirm no alert and the field resets to the default.
4. **localStorage key namespaced** (`machinalab:mmt15603:v2`) and wrapped in try/catch.
5. **CSV injection.** Every cell that starts with `=`, `+`, `-`, `@`, tab or CR is prefixed
   with `'`. Numbers are written as numbers (negative numbers are exempt only when they are actual
   numeric values, not strings). Test with notes containing `=HYPERLINK("http://x","y")`.
6. **CSP meta tag** present and as specified in CLAUDE.md. Confirm there are no inline
   `<script>` blocks, `on*=` attributes or `style=` attributes (`grep -nE 'on[a-z]+=|style="' site/`).
   In the browser console the CSP must report no violations. Automated: `tests/browser/a11y.spec.js`
   ("CSP: …" tests over http and file://, plus an enforcement test).
7. **No external requests** at runtime: no CDNs, fonts or analytics. `grep -nE 'https?://' site/`.
   Any hit must be a plain link the student clicks, never a resource load.
8. **Deploy scope.** `.github/workflows/deploy.yml` uploads `site/` only. After deploying,
   confirm `/<repo>/CLAUDE.md` and `/<repo>/.claude/` return 404.
9. **Actions pinned.** Third-party actions are pinned to a full commit SHA (with a version
   comment), and `permissions:` is minimal.
10. **No secrets or personal data** in the repo: grep for emails, student names, tokens.
11. **Dependencies.** Runtime: none. Dev: run `npm audit --omit=optional` and report
    highs. Dev deps are never shipped.

## Output

A table with item, status, evidence (command and output, or file:line) and fix. Fix only
what's in scope for the current stage. List the rest as follow-ups. Never claim a check
passed without running it.
