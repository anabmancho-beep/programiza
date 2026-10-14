<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Multi-tenant isolation: every app table carries center_id and RLS checks `current_center_id()` + `is_staff()`/`has_role()` (security definer helpers) — avoids policy recursion and cross-center leaks.
- Privileged actions (center creation/join, roles, export, anonymize, demo data, access log) go through security-definer RPCs, never direct table writes — keeps role changes admin-only.
- Consent and plan-hierarchy rules are enforced by DB triggers (persons_guard, plans_guard), not only UI — the backend is the source of truth.
