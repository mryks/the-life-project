# Deployment & Vercel

> Hub: [[00 - Atlas (Index)]] | Related: [[Cloud Sync & Supabase]], [[Changelog & Step Log]]

---

## 🚀 Production Target

- **Production URL**: [`https://the-life-project-os.vercel.app/`](https://the-life-project-os.vercel.app/)
- **Hosting Platform**: Vercel.
- **Git Deployment Integration**: Connected to GitHub repository `mryks/the-life-project`.
- **Target Branch**: `main`.

---

## ⚠️ Critical Deployment Invariants & Gotchas

1. **Strict TypeScript Checking on Vercel Builds**:
   - Vercel automatically runs `next build`, which executes full TypeScript type checking across the entire repository (including `tests/`).
   - Any type mismatch, such as accessing a union property without narrowing (e.g. `exp.accountId` on `TransferEvent`), immediately causes Next.js build failure with exit code 1.
   - When a build fails, Vercel **silently maintains the previous working deployment**, meaning newly pushed commits do not go live!
   - **MANDATORY RULE**: Always verify `npm run build` locally before pushing to remote branches to guarantee successful Vercel deployment!

2. **Environment Variables on Vercel**:
   - Client-accessible variables must have the `NEXT_PUBLIC_` prefix:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - Server-only variables:
     - `MASTER_PIN`
   - These variables must be configured in Vercel Project Settings > Environment Variables for production environments.

3. **Multi-Branch Synchronization**:
   - To prevent branch divergence, always commit and push changes simultaneously to both `finance-foundation` and `main`:
     ```bash
     git push origin finance-foundation
     git push origin finance-foundation:main
     ```

4. **Duplicate Vercel Projects (`eta` vs `os`)**:
   - `the-life-project-eta.vercel.app`: Legacy/duplicate project. It does NOT have Supabase environment variables configured (`isSupabaseConfigured() === false`).
   - `the-life-project-os.vercel.app`: Active official production deployment.
   - **Safe Deletion Protocol**: If the user has any transactions recorded solely in `the-life-project-eta` on their phone, they should first export them via JSON Backup and restore them into `the-life-project-os`. Once restored, the `the-life-project-eta` project in Vercel can be safely deleted.

5. **Open-Source Privacy Guarantees**:
   - **Zero Financial Data on GitHub**: The GitHub repository stores 100% application code only (TypeScript, React components, CSS, SQL migrations).
   - All transactions reside exclusively in the user's private Supabase database and local device storage.
   - All database secrets and Master PIN are in `.env.local` which is permanently ignored by `.gitignore`.
   - The web app is shielded by single-user Master PIN authentication. No public GitHub visitor can view or alter financial data.
