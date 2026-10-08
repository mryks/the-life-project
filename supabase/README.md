# The Life Project — Supabase Setup & Cloud Sync Guide

This guide explains how to connect **The Life Project** to your free-tier Supabase PostgreSQL database for seamless, real-time synchronization between your PC and smartphone.

---

## Step 1: Create a Free Supabase Project
1. Log in to [Supabase](https://supabase.com).
2. Click **"New Project"**.
3. Choose a project name (e.g. `the-life-project-vault`) and a database password.
4. Select the region closest to you (e.g., `Southeast Asia (Singapore)`).
5. Wait ~1-2 minutes for your project to provision.

---

## Step 2: Execute the Database Schema
1. In your Supabase Dashboard, click on **SQL Editor** in the left sidebar.
2. Click **"New query"**.
3. Open `supabase/schema.sql` from this repository, copy all the SQL code, and paste it into the SQL Editor.
4. Click **"Run"** (or press `Ctrl+Enter`).
5. You should see `Success. No rows returned`.
6. Click **Table Editor** to confirm that the `financial_events` table was created with all columns and indexes.

---

## Step 3: Copy Your Project API Credentials
1. In your Supabase Dashboard, click on the **Settings (gear icon)** at the bottom of the left sidebar.
2. Navigate to **API**.
3. Locate:
   - **Project URL** (e.g., `https://abcdefghijklm.supabase.co`)
   - **Project API Keys** -> `anon` `public` key (a long JWT token starting with `eyJhb...`)

---

## Step 4: Configure Local Environment
1. In the root folder of this project (`c:\Projects\the-life-project-antigravity`), create a file named `.env.local` (or copy `.env.example` to `.env.local`).
2. Add your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
3. Restart your Next.js development server:
   ```bash
   npm run dev
   ```

---

## Step 5: Automatic Migration & Cloud Sync
Once `.env.local` is present:
- The app will automatically detect your Supabase connection.
- A **Cloud Sync Indicator** will appear in the navigation bar (`🟢 Synced` / `🟡 Syncing`).
- All existing transactions currently in your local storage will automatically migrate to Supabase without manual effort.
- Any new transaction created on your PC or smartphone will automatically sync in the background!
