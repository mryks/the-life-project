# Antigravity App Migration & Continuity Protocol

Dokumen ini merupakan panduan kelanjutan (session handoff) dan ringkasan arsitektur lengkap proyek **The Life Project** untuk digunakan saat bekerja di **Antigravity App (Desktop)**.

---

## 1. Identitas & Domain Aktif
- **Repository Path:** `c:\Projects\the-life-project-antigravity`
- **Domain Aktif:** Personal Finance (Daily expense tracker & financial dashboard).
- **Target Pengguna:** Pengguna tunggal (single-user personal use) harian di PC dan Smartphone (PWA).
- **Mata Uang:** IDR (Indonesian Rupiah) dengan format pemisah titik (`Rp 50.000`).
- **Keamanan:** Master PIN terenkripsi + WebAuthn biometric sensor.
- **Database Target:** Supabase PostgreSQL (`peydzblrtfgdoaisljkm.supabase.co`) dengan sinkronisasi local-first outbox queue.
- **Production URL:** [https://the-life-project-os.vercel.app/finance](https://the-life-project-os.vercel.app/finance) (Vercel)

---

## 2. Invarian Arsitektur & Aturan Utama (Strict Rules)
1. **FinancialEvent Single Source of Truth:**
   - Semua saldo, total, grafik, dan ringkasan adalah *derived data* yang dihitung secara deterministik murni dari event `income`, `expense`, `transfer`, dan `refund`.
   - Refund dan Cashback memiliki relasi langsung ke parent expense; tidak berdiri sendiri secara arbitrer.
2. **Akun Finansial (17 Akun Terpartisi):**
   - **10 Akun Liquid:** Cash (`c`), BNI (`b`), GoPay (`g`), ShopeePay (`s`), Jago Yoel (`jy`), e-money (`e`), SeaBank (`sea`), Bank Saqu (`q`), Jago (`j`), Clara (`cla`).
   - **7 Akun Investasi:** KOINS (`k`), HP (`h`), Stockbit (`sb`), POEMS (`poe`), KB (`kb`), IPOT (`i`), Portfolio (`p`).
   - Total Liquid Balance hanya menghitung akun Liquid.
3. **Front-End & Mobile Physics:**
   - Aturan baku diatur dalam `.agents/skills/senior-frontend-engineer/SKILL.md`.
   - **Single-Step Pagination Invariant:** Swipe pada tab carousel (Overview, Accounts, Activity) dibatasi **maksimal $\pm 1$ tab per gestur**, secepat atau sepanjang apa pun tarikan swipe.
   - **Zero Tab Bleed:** Kontainer track swipe menggunakan `w-full overflow-hidden`, padding dan max-width berada di dalam masing-masing tab.
   - **Kinetic Release Polish:** Animasi touch release menginjeksi release velocity ke Framer Motion spring physics (`stiffness: 280, damping: 32, mass: 0.8`).
   - Non-active tab DOM isolation: unmounted saat settled untuk mencegah reflow di tengah swipe.
4. **Desain & UI:**
   - 100% Bahasa Inggris untuk seluruh label UI, modal, dan pesan error.
   - Dilarang keras menggunakan emoji Unicode default keyboard (gunakan `lucide-react` / `@phosphor-icons/react`).
   - Angka monospaced tabular (`Sora` / tabular numbers).

---

## 3. Lokasi Konfigurasi & Sumber Daya
- **Aturan Proyek:** [AGENTS.md](file:///c:/Projects/the-life-project-antigravity/AGENTS.md) dan [GEMINI.md](file:///c:/Projects/the-life-project-antigravity/GEMINI.md).
- **Workspace Skills (24 Skills):** Terletak di `.agents/skills/` (otomatis dimuat saat folder proyek dibuka di Antigravity App).
  - Termasuk `senior-frontend-engineer`, `casual-modern-ui`, `mobile-native`, `animate`, `apple-design`, `obsidian-vault`, dll.
- **Memory Bank:** Terletak di `.agents/memory/`:
  - `activeContext.md`: Konteks aktif hingga Langkah 32 (Swipeable Tabs & Tab Bleed Polish).
  - `progress.md`: Riwayat lengkap 15 milestone, 217 unit tests lulus (100%).
  - `systemPatterns.md`, `projectBrief.md`, `techContext.md`.
- **Knowledge Vault:** Terletak di `memory/` (Obsidian bi-directional markdown vault).

---

## 4. Database Riwayat Percakapan (Migrated)
Percakapan selama ini (`bd5b8f16-37f8-4d65-8f88-b5e4353e077c`) yang berisi seluruh 7.000+ langkah, tangkapan layar, audit, dan diskusi telah disalin langsung ke direktori Antigravity App:
- Database: `C:\Users\DELL\.gemini\antigravity\conversations\bd5b8f16-37f8-4d65-8f88-b5e4353e077c.db`
- Brain & Logs: `C:\Users\DELL\.gemini\antigravity\brain\bd5b8f16-37f8-4d65-8f88-b5e4353e077c\`
- Terdaftar di: `C:\Users\DELL\.gemini\antigravity\conversation_summaries.db`

---

## 5. Cara Memulai di Antigravity App
1. Buka aplikasi **Antigravity** (Desktop App).
2. Pilih / Open folder kerja: `c:\Projects\the-life-project-antigravity`.
3. Anda dapat:
   - **Opsi A (Melanjutkan sesi langsung):** Buka sesi percakapan dari panel histori riwayat di sebelah kiri, berjudul **"The Life Project - Personal Finance & UI Polish"**.
   - **Opsi B (Chat baru dengan referensi percakapan):** Buat chat baru, lalu ketik prompt berikut:
   ```text
   Halo! Lanjutkan pekerjaan kita dari percakapan sebelumnya (@bd5b8f16-37f8-4d65-8f88-b5e4353e077c).
   Baca HANDOFF_TO_ANTIGRAVITY_APP.md, .agents/memory/activeContext.md, dan AGENTS.md.
   Kita baru saja menyelesaikan Langkah 32 (Polish swipeable tabs smooth motion & no-bleed).
   Semua 217 test passing dan sudah terdeploy di Vercel. Tolong konfirmasi pemahaman konteksmu.
   ```
