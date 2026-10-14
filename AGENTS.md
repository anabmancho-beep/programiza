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
- AI calls live in src/lib/ai.functions.ts (requireSupabaseAuth) + ai.server.ts; payloads are rebuilt server-side from a field whitelist (type, age range, autonomy levels, result counts) — never send codes, center, diagnosis or free text.
- AI output is stored as status='borrador' + ai_generated; approval fields are only settable through approve_item() (trigger-enforced) so authorship can't be forged.
- Restricted modules (behaviour ABC, anticipation plan, medication, appointments) have no table grants for authenticated; all reads/writes go through security-definer RPCs (get_behavior_module, get_health, save_sensitive, delete_sensitive) that check is_pro() and always log — so access can't bypass the audit log.
- Family accounts (role familia) read only through family_* RPCs returning whitelisted columns; staff-only RLS on every table stays unchanged — avoids leaking internal notes via direct table reads.
- Multi-center: profiles.center_id is the active center; user_roles holds one row per center and switch_center() changes it — all RLS keeps using current_center_id().
- Pictogram files live in private bucket "pictogramas" under <center_id>/ and are shown via signed URLs.
