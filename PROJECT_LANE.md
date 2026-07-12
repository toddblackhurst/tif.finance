# TIF Financial Database Manager - Project Lane

Status: active_project_lane
Role: Current TIF finance app lane for donations, donors, reimbursements, bank review, reports, and public reimbursement submissions.

## Control Plane Relationship

Life Organization routes and verifies cross-project work, but this project remains its own execution lane and source-of-truth boundary.
Codex is the primary execution surface for this lane. ChatGPT or Claude may act
as bounded architect/review partners when helpful, but they do not replace live
source proof or become the default working surface unless Todd explicitly asks.

## Partner Model Routing

For the named categories `assistant-system`, `migration`, `repeated-friction`,
and `cross-project architecture`, use ChatGPT Pro as the default direction loop
even when Codex remains the primary work surface.
Use Claude Code as the bounded local review partner for risky local edits,
runner changes, and second-pass verification-plan critique.
Use the ready Google-native terminal helper as the first Codex-terminal Google
lane when Google-context work is needed. Use Gemini as the bounded
Google-context partner in the secondary Google lane only after its own local
auth/readiness is proved, and keep that lane read-only or draft-first until
live proof says otherwise.

## Canonical Entrypoints

- AGENTS.md
- README.md
- package.json
- supabase/migrations/
- src/app/[locale]/(app)
- src/app/[locale]/submit

## Source Surfaces

- local_files
- Supabase
- TIF Financial Reports
- Google Drive/Sheets
- email notifications

## Assistant Upgrade Sequence

- Tighten named instruction surfaces before broader source deepening when Todd
  has already authorized the destination family.
- Handle one exact destination at a time with same-session readback, exact
  diff, rollback path, apply, and post-write verification.
- Keep private-source reads bounded to a specific unresolved behavior or style
  gap; broad approval alone is not a reason to deepen access.
- Keep automations, reminders, monitors, and wakeups last because they amplify
  mistakes.

## Tool And Browser Access

- Browser and connector access to this lane's source surfaces is allowed when Todd asks for live readback, setup, login, or verification.
- Todd's task-specific permission stands until he revokes it; do not repeatedly re-ask for the same browser, connector, login, readback, or verification access in the same task.
- Login, passkey, 2FA, payment, banking, account-security, and permission screens are not by themselves a reason to refuse or stop when Todd has authorized that workflow.
- Use available approved browser, connector, credential-helper, and local-tool surfaces to proceed. Never print, expose, or persist secrets in chat, docs, logs, or memory.
- Do not disable, quarantine, remove, hide, or narrow a tool, connector, browser path, automation, or launch agent that Todd regularly uses unless Todd explicitly approves that specific removal first.
- After access is available, continue with readback/verification from the live source.

## Proof Standard

Current financial-manager readback only; old stewardship dashboard references are not current proof.

## Approval Boundaries

- No financial data mutation, reconciliation change, sharing/permission change, or account action without task-specific approval.

## Completion Language

Finish work as verified, drafted/staged, blocked, or needs Todd action. Do not claim done from a draft, local file, command pass, deploy start, upload start, or local service status alone.
