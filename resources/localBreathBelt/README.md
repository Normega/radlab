# Local BreathBelt deployment

Everything needed to run **BreathBelt** locally on a lab rig, including the
Biopac parallel-port trigger path. Pull the repo on the testing computer and
follow the steps below.

> **Why local?** The trigger server runs on `http://localhost:8765`. Browsers
> block `http://localhost` calls made from an `https://` page (mixed content),
> so the Biopac rigs must run BreathBelt from the **local dev server**
> (`http://localhost:5173`), not the deployed Vercel URL. (AD_BBT, which uses
> Web Serial, works either way — but running locally keeps both rigs identical.)

---

## What's in this folder

| File | What it is |
|---|---|
| `parallel_server.py` | Local Flask helper. Relays browser `POST /send {address, value}` to the parallel port and answers `GET /status`. Listens on `localhost:8765`. |
| `inpoutx64.dll` | 64-bit parallel-port driver (preferred on modern Windows). Must sit next to `parallel_server.py`. |
| `inpout32.dll` | 32-bit fallback driver. |
| `Template.acq` | AcqKnowledge graph template for the Biopac recording — open it in AcqKnowledge before starting a session so the event-code channels/markers are set up. |
| `trigger-tester.html` | Standalone diagnostic page (no build needed) for poking the trigger hardware directly. Just open it in Chrome/Edge. |

---

## First-time setup (once per computer)

1. **Install Python 3** and make sure it's on your PATH.
   - Download from <https://www.python.org/downloads/> (check "Add python.exe to PATH"), or run `winget install Python.Python.3`.
   - Verify: `python --version`
2. **Install the trigger-server dependencies:**
   ```powershell
   pip install flask flask-cors
   ```
3. **Install Node.js** (includes npm) from <https://nodejs.org> if not already present. Verify: `node --version`
4. **Get the repo** (if not already cloned), on the `breathbelt-bbtk-triggers` branch:
   ```powershell
   git clone https://github.com/Normega/radlab.git
   cd radlab
   git checkout breathbelt-bbtk-triggers
   npm install
   ```
5. **Create `.env.local`** in the repo root with the Supabase keys (see `.env.example`):
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

---

## Before every run

1. **Start the parallel-port server** — from *this* folder, in its own window, and leave it open:
   ```powershell
   python parallel_server.py
   ```
   It prints `Loaded inpoutx64.dll` and `running at http://localhost:8765`. (The DLLs are already alongside it here.) If you see "No inpout DLL found," you're running it from the wrong folder.

2. **Start the dev server** — from the repo root, in a second window:
   ```powershell
   git pull                # get the latest first
   npm run dev             # → http://localhost:5173
   ```

3. **Open the app** in Chrome or Edge:
   ```
   http://localhost:5173/games/breath-belt
   ```

---

## Running a session

1. Connect the Polar H10 belt.
2. On the connect screen, pick the **Trigger device** for this rig — `Biopac — Left rig`, `Biopac — Right rig`, or `AD Instruments + Black Box ToolKit (AD_BBT)`.
3. Click **Check parallel server** (Biopac) / **Connect to COM port** (AD_BBT).
4. On connect, a **1–13 test cascade** fires automatically — confirm all 13 marks appear in AcqKnowledge/LabChart. Use **Send test cascade again** to repeat if needed, then **Continue to session setup**.
5. Proceed through calibration → baseline → phases → post-baseline as normal.

---

## Quick reference

| | |
|---|---|
| Trigger server | `python parallel_server.py` → `http://localhost:8765` |
| Dev server | `npm run dev` → `http://localhost:5173` |
| App URL | `http://localhost:5173/games/breath-belt` |
| Biopac — Right | parallel port `0xD030`, code sent as-is |
| Biopac — Left | parallel port `0xCFF8`, code × 16 |
| Event codes | 1–13 (see `src/games/BreathBelt/TRIGGERS.md`); 0 = line-clear |

For full architecture, see §20 of `website.md` and `src/games/BreathBelt/TRIGGERS.md` in the repo.
