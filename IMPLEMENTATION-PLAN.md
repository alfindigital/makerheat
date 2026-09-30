# MakerHeat — Implementation Plan (gabungan MakerHeat + GhostTape)

Tanggal: 30 September 2026 (WIB). Status: **task-level plan; belum ada kode**.
Spec kanonik: [`ideas/MakerHeat-GhostTape-concept.md`](../ideas/MakerHeat-GhostTape-concept.md) — dokumen ini tidak mengulang argumennya, hanya memecahnya jadi urutan kerja.

## Prinsip yang tidak bisa ditawar (dari spec — dipegang di setiap task)

1. **Deskriptif saja.** Tidak ada label risiko/klasifikasi token (insider, sybil, cabal, coordinated, organic, safe, risky, exit-blocked, honeypot, FULL-COVERAGE). Daftar kata terlarang hidup di `src/policy/claims.ts` dan dites terhadap seluruh string UI/API/docs di Task B9.
2. **Satu Observation → semua lensa.** Concentration, sell-context, dan sensitivity dihitung dari capture yang sama dengan window + filterPolicy identik. Dilarang menggabungkan angka dari sampel berbeda seolah satu pengukuran.
3. **Per-page depth curve**, bukan perbandingan dua titik. Probe sesi ini membuktikan 30 halaman / 3.000 event per token (JUP 26 mnt, UNI 18,5 jam) + time-travel `endTime`. `maxPages` adalah keputusan budget, bukan batas teknis.
4. **Missing ≠ nol.** `missing`/`unavailable`/`zero-unverified`/`inconsistent` adalah state eksplisit; headline dilarang dibangun di atas denominator nol atau field `zero-unverified` (`hld` mati — 118/125 capture `"0"`).
5. **`buyObserved` ≠ `B_i > 0`.** Buy event dengan USD missing/nol tetap mengubah status no-buy; ukuran buy ditampilkan agar status biner tidak dibaca berlebihan.
6. **Fixtures sebelum parser.** Tidak ada baris parser/engine sebelum fixture nyata + manifest hash ada.
7. **Raw bodies internal-only** sampai hak redistribusi CMC jelas. Publik = derived metrics + hash + request metadata. Tidak ada raw JSON download publik.
8. **AI deferred.** Jev (proposisi observable) + DeepSeek (caption grounded) adalah Phase G — tidak ada kode AI sebelum Gate D lulus dan API key tersedia.
9. **Determinisme.** Dataset sama + methodVersion sama → byte-identical output. Tie-break kanonik: sell USD desc → address byte-ASCII asc. Fraksi internal 0..1, format hanya di UI.
10. **Key di server.** Per-IP limit + atomic global credit budget. Tidak pernah rotasi key untuk menghindari 429.

## Keputusan yang masih terbuka (dicatat supaya tidak diputuskan diam-diam)

| # | Keputusan | Kapan wajib diputus | Opsi |
|---|---|---|---|
| D-1 | Store untuk atomic quota + single-flight | Sebelum D2 | Vercel KV / Upstash Redis / Neon+advisory lock |
| D-2 | Store untuk Observation permanen | Sebelum D4 | Postgres (Neon) + object storage private (Vercel Blob/S3) — hanya jika hak data jelas |
| D-3 | Headline default: sell-side vs all-side | Gate C usability | Default spec = sell; toggle [Sell\|Buy\|All] selalu ada |
| D-4 | Live publik vs replay-only di rilis pertama | Setelah D4 | Replay+demo dulu juga sah |
| D-5 | `maxPages` default deep | D1 setelah ukur latency/credit | Evidence: 30 terbukti; budget yang menentukan |
| D-6 | Deploy target | C1 | Vercel (Next.js) — asumsi default spec |

---

## PHASE 0 — Repo & harness

### Task 0.1 — Scaffold repo

- Buat struktur `makerheat/`:

```text
makerheat/
├── IMPLEMENTATION-PLAN.md      (file ini)
├── package.json  tsconfig.json  vitest.config.ts  .gitignore  .env.example
├── src/
│   ├── lib/        # parser, eligibility, concentration, sellcontext, comparisons, quality
│   ├── policy/     # claims.ts (banned vocabulary + claim policy)
│   ├── server/     # collector, cache, quota, storage adapters
│   └── types.ts    # Observation, SwapRow, SideMetrics, Receipt, enums
├── fixtures/       # real captures (internal) + manifest sha256
├── fixtures-synthetic/  # labeled synthetic edge cases
├── tests/          # vitest
├── tools/          # capture-fixtures.mjs, verify-fixtures.mjs, verify-engine.mjs, scan-vocab.mjs
├── app/            # Next.js UI (Task C)
└── docs/           # METHOD.md, CLAIMS.md, ENDPOINTS.md, FRICTION.md
```

- `git init` di `makerheat/` (parent `cmc-api-hackaton` bukan repo; Verdex punya repo sendiri — jangan campur).
- `.gitignore`: `node_modules/`, `.next/`, `dist/`, `.env*`, `fixtures/raw-private/` (bila raw bodies disimpan terpisah dari manifest hash-nya).
- `.env.example`: `CMC_API_KEY=` tanpa nilai.
- package.json: `pnpm`, engines node>=20, scripts `test`, `typecheck`, `verify:fixtures`, `verify:engine`, `scan:vocab`.
- Deps awal: typescript, vitest, tsx. UI deps ditunda ke Task C1.
- Key loading: `node --env-file` atau dotenv — key dibaca dari `makerheat/.env.local` ATAU `../verdex/.env.local` via path env `CMC_ENV_FILE`; **tidak pernah** di-copy isinya.

**Verify:** `pnpm i` bersih; `pnpm test` hijau pada satu test trivial; `git status` bersih setelah commit pertama.
**Audit:** `git ls-files | xargs grep -l "CMC_PRO_API\|eyJ\|apikey"` → kosong; `.env.local` tidak ter-track; initial commit ada.

---

## PHASE A — Kontrak data (Gate A)

### Task A1 — METHOD.md + CLAIMS.md + claims policy

- `docs/METHOD.md`: methodVersion `1.0.0`, definisi basis (`baseEligible` dan dua subsetnya), denominator `S`/`B`/`B+S`, rumus C3/HHI/effectiveMakers/G_W/U_W/X_W, tie-break kanonik, stop reasons, semantics `buyObserved`, nested-sensitivity vs temporal-persistence.
- `docs/CLAIMS.md`: yang boleh vs tidak boleh diklaim; "hash = integrity receipt, bukan proof of provider truth"; "address ≠ orang/entitas"; "sellability not tested".
- `src/policy/claims.ts`: array kata/frasa terlarang (case-insensitive) + allowlist lokasi (file policy/docs yang menyebut larangan itu sendiri).
- Field map beku (terverifikasi audit): `f` = factory/program (bukan pool — `pools[].fa` 95/100, `pools[].addr` 0/100); symbol token = `sym`; stats pct = `pc`; `h` = block height (BUKAN tx id fallback); `pubAt`/`fpt`/`fpct` = timestamp berbeda, tidak saling menggantikan.

**Verify:** docs ada, methodVersion tertulis, policy file compile.
**Audit:** baca ulang CLAIMS vs spec §5–§7 poin demi poin — ceklist manual, bukan skim.

### Task A2 — Fixture nyata + manifest

- `tools/capture-fixtures.mjs`: keyed `/v1/` path, arg `--chain --address --pages --endTime`, tulis body mentah + meta (endpoint, params tersanitasi, status, credits, capturedAt).
- Capture minimal (pakai evidence yang sudah ada + tambahan bila perlu):
  - JUP/Solana 2 halaman keyless yang sudah ada di `ghosttape/research/2026-09-30/` → copy (bukan move) sebagai `fixtures/jup-solana-p1.json`, `p2.json`.
  - UNI/Ethereum + VIRTUAL/Base: capture baru 3 halaman keyed (masing-masing ~3 kredit) — per-chain fixture untuk address casing.
  - `/v1/dex/token` (metadata) + `/v1/dex/token/pools` untuk ketiga token.
  - Satu `/v1/dex/search` response (untuk resolver).
  - Edge nyata bila ditemukan: halaman kosong, token tipis (<100 event total).
- `fixtures/manifest.json`: nama file, sha256, chain, address, pages, capturedAt, endTime, credit cost.
- Pisahkan tegas: `fixtures/` (real, internal) vs `fixtures-synthetic/` (labeled).

**Verify:** `verify:fixtures` — semua sha256 cocok; setiap fixture parse OK; jumlah event/halaman sesuai manifest.
**Audit:** konfirmasi zero overlap `tx|lgid` antar halaman; `endTime` benar-benar ms (bug detik tercatat di history); tidak ada secret di fixture headers.

### Task A3 — Fixture edge sintetik

Tulis `fixtures-synthetic/` (semua labeled `synthetic`):

- `denominator-zero`: sell events ada tapi semua USD null → `unavailable`, bukan 0%.
- `maker-null-sell`: sell valid tanpa `ma` → tetap di sell count, USD masuk `unattributedSellUsd`.
- `buy-usd-missing`: buy event ada, `v` null → `buyObserved=true` tapi `B_i` tidak bertambah.
- `single-event` / `single-maker`: satu event → share 100%, tampil exact count.
- `dup-boundary`: event sama di ujung dua halaman (cursor edge) → dedup menghapus tanpa menghilangkan tetangganya.
- `all-sells` / `all-buys`: satu sisi kosong → metrik sisi itu `unavailable`, sisi lain valid.
- `sts-inconsistent`: `ut` di luar `[max(but,sut), but+sut]` → breadth turunan `unavailable`.
- `untrusted-text`: `n`/`sym` berisi `<img onerror>` / teks panjang → disimpan apa adanya, dirender escaped.

**Verify:** tiap fixture synthetic punya file + expected-outcome note.
**Audit:** reviewer manusia baca 2 fixture acak — nilai sengaja dibuat aneh untuk menguji jalur, bukan menyerupai data nyata.

> **Gate A check:** field map diverifikasi otomatis pada fixture bytes (script assert `f`∈`pools[].fa`, `sym` ada, `pc` ada); manifest valid; synthetic terpisah. Lulus → Phase B.

---

## PHASE B — Deterministic engine (Gate B)

Urutan dalam fase ini penting: types → parser → eligibility → metrics → comparisons → golden replay.

### Task B1 — `src/types.ts`

Kontrak persis spec §8: `Observation` (schemaVersion, id, capturedAt, mode live|replay|synthetic, token, window{requested,observed,pagesFetched,stopReason}, filterPolicy, quality, concentration{buy,sell,all}, sellContext{noBuyObservedShare, observedNoBuySellers, positiveUsdNoBuySellers, top3OverlapShareOfAllAttributedSells}, makers[], sources[], methodVersion, parserVersion) + `SideMetrics` (topN shares, denominator, HHI, effectiveMakers, quality status) + `MakerContribution` (address, buy/sell USD nullable, buyObserved bool, eventCount, eventRefs) + `SourceReceipt` (endpoint, params tersanitasi, ts req/resp, status, sha256, credits) + enums `QualityState = valid|missing|zero-unverified|inconsistent|unavailable`, `StopReason = target_bound_reached|cursor_exhausted|page_budget|time_budget|quota_limit|provider_error|cursor_stalled`.

**Verify:** `pnpm typecheck` pada file kosong implementasi; kontrak diekspor.
**Audit:** diff field-per-field vs spec §8 — tidak ada field hilang/rename.

### Task B2 — `src/lib/parser.ts`

- Raw row → `SwapRow {platform, tx|null, lgid|null, f|null, h|null, ts, side: buy|sell, usd: number|null, qty, maker: string|null, raw}`.
- `ma` normalisasi: EVM → lowercase; Solana/dll → preserve case. Chain diketahui dari input scan.
- `tx` null tetap null — **dilarang** fallback `h`.
- `tp` → side; nilai tak dikenal → rejected row + reason.
- `v` harus finite & ≥0; null/missing tetap null (bukan 0).
- Rejected rows: kumpulkan `{index, reason}` — masuk `quality.rejectedEvents`.
- Dedup key: `platform|tx|lgid|f`; row tanpa cukup identitas → `dedupStatus: uncertain`, tetap dihitung tapi dilaporkan.

**Verify:** test per-field dari fixture; 3.000-event fixture ter-parse tanpa throw.
**Audit:** grep parser — tidak ada `?? 0` pada `v`/`ma`/`tx`; tidak ada referensi `h` sebagai tx.

### Task B3 — `src/lib/eligibility.ts`

- `baseEligible` = exact chain+contract, side valid, ts valid ∈ W.
- Subset `usdValid`, `makerValid` sesuai spec §5.1.
- `filterPolicy` record: bothSides=true wajib untuk sellContext (tape yang di-filter side/maker/minVolume dilarang jadi basis no-buy share → status `not evaluable`).

**Verify:** unit test subset inclusion: `makerValid ⊆ usdValid ⊆ baseEligible` pada fixture campuran.
**Audit:** satu fixture synthetic `maker-null-sell` — sell tetap dihitung sebagai sell teramati.

### Task B4 — `src/lib/concentration.ts`

- Per maker `i`: `B_i`, `S_i`, `buyObserved_i`, `sellObserved_i`.
- SideMetrics per sisi: `topN` (N konfigurabel, default 3; "Top N" N aktual bila seller < 3), `HHI`, `effectiveMakers`, `uniqueMakers`, `denominatorUsd`, `unattributedUsd`, `quality`.
- `largestEvent` per sisi (untuk sensitivity): eventRef + usd.
- Ranking: usd desc → canonical address byte-ASCII asc. `methodVersion` menyimpan kebijakan ini.

**Verify:** JUP fixture → top-3 sell 83.69%/65.12% dan effective 3.90/5.47 reproduksi persis (golden di B8).
**Audit:** rekomputasi manual 1 halaman via `tools/verify-engine.mjs` (independent code path — baca raw bytes, hitung ulang, diff).

### Task B5 — `src/lib/sellcontext.ts`

- `G_W`, `U_W` (spec §5.3); dua count terpisah (`observedNoBuySellers`, `positiveUsdNoBuySellers`); `X_W` joint (§5.4).
- Creator address (bila terverifikasi dari metadata/pools) = **bucket terpisah yang dilaporkan** — tidak pernah di-exclude diam-diam; flag `creatorObserved` di MakerContribution.
- Buy-size dipermukaan: tiap seller row membawa `buyUsd` (nullable) untuk kolom "Buy in sample".

**Verify:** reproduksi 61.03%/19.28%, count 14/17, X 46.21%→0.00%.
**Audit:** kasus $10.31-buy/$2,066-sell — seller itu harus `buyObserved=true` dan UI table menampilkan "$10.31", bukan "no buy".

### Task B6 — `src/lib/comparisons.ts`

- `depthSweep(observation)`: recompute semua metrik per prefix kumulatif tiap halaman → `depthCurve[]` {events, spanSec, topN, hhi, noBuyShare, xShare}. Inilah headline visual (amendment: per-page, bukan 2 titik).
- `removeLargestEvent(observation, side)` → Observation alternatif labeled "sample variant"; tie-break eventId eksplisit.
- `windowPersistence(obsA, obsB)` → stub signature sekarang; implementasi di Phase E (interval non-overlap, comparability status). Nested ≠ persistence ditegaskan di METHOD.md.

**Verify:** curve length == pagesFetched; delta sign konsisten dengan golden.
**Audit:** pastikan joint share ≤ min(parent shares) pada semua fixture (quality gate spec §15).

### Task B7 — Determinism & i18n safety

- Tidak ada `Date.now()`/`Math.random()` di path engine; `capturedAt` dari receipt.
- Sort comparator total order; `toLocaleString`/`Intl` hanya di UI.
- Fraksi internal 0..1; persen dibentuk di render.

**Verify:** dua run engine pada fixture sama → `JSON.stringify` byte-identical.
**Audit:** `rg "Date\.now|Math\.random|toLocaleString" src/lib` → kosong (kecuali komentar).

### Task B8 — Golden replay suite (regression resmi)

`tests/golden.test.ts` pin angka bukti JUP (basis sell-side, attributed USD):

| Metrik | 100 ev | 200 ev |
|---|---:|---:|
| top-3 sell share | 83.69% | 65.12% |
| no-buy share | 61.03% | 19.28% |
| sellers no-buy (count) | 14 | 17 |
| X (top-3 ∩ no-buy) | 46.21% | 0.00% |
| effective sell makers | 3.90 | 5.47 |
| top-3 tanpa largest sell event | — | 56.95% (−8.17pp) |
| no-buy share tanpa largest | — | 23.79% |

Plus: all-side curve dari `makerheat-depth-sample1.json` (77.7→35.9 JUP) sebagai golden kedua untuk lensa konsentrasi.

**Verify:** suite hijau; `verify:engine` independent recompute → diff kosong.
**Audit:** toleransi float eksplisit (≤1e-9 pada fraksi); angka golden dicross-check sekali lagi terhadap `mix-evidence-example.json` mentah.

### Task B9 — Vocabulary & claim-policy test

`tools/scan-vocab.mjs` + `tests/vocab.test.ts`: grep terlarang pada `app/`, `src/` (kecuali `policy/`), API responses, generated share text, README/docs publik. Allowlist: file yang mendefinisikan larangan.

**Verify:** introdusir kata "safe" di satu string UI → test merah; revert → hijau.
**Audit:** cek kalimat UI manual — "kalimat bisa menyiratkan tuduhan tanpa kata terlarang" (spec §10); contoh "these wallets are dumping" tetap terlarang secara makna → wording UI disetujui manusia, dicatat di CLAIMS.md.

> **Gate B check:** golden hijau, determinisme byte-identical, independent recompute cocok, edge cases spec §15 semua punya state benar. Lulus → Phase C.

---

## PHASE C — Satu layar yang bermanfaat (Gate C)

### Task C1 — Next.js scaffold

- `app/` Next.js 15 + TypeScript + Tailwind v4 (selaras ekosistem). `pnpm build` hijau pada halaman kosong.
- Visual: Evidence Desk language (Verdex direction A) — dark, mono untuk data; tidak ada gradient/glow/fake terminal.

**Verify:** build + render smoke.
**Audit:** tidak ada telemetry/dependency liar; `package.json` pin versi (no `latest`).

### Task C2 — Resolver

- Input: contract address (wajib) + chain (dropdown). Validasi format per chain.
- Ticker input → `/v1/dex/search` → picker saat collision. (AmbiguityDesk v2 sudah punya venue-split/family/farming flags — evaluasi reuse sebagai dependency nanti; untuk v1 resolver lokal minimal saja, jangan import silang dulu.)

**Verify:** query ambigu menampilkan picker; address langsung → scan.
**Audit:** picker tidak pernah auto-pilih saat tie/ambigu.

### Task C3 — Scan API + replay route

- `POST /api/scan` {chain, address, tier:`quick|deep`, endTime?} → `Observation`.
- `GET /api/scan/[id]` → stored observation; `?fixture=<name>` untuk replay.
- Replay/live badge wajib; capturedAt selalu terlihat.

**Verify:** replay JUP fixture → JSON sama dengan engine output; scan live smoke (Phase D mengaktifkan — di C boleh mock collector).
**Audit:** response tidak membawa raw body provider; hanya derived + receipt meta.

### Task C4 — Contribution screen (wireframe spec §6)

Komponen wajib:

- Header: token, chain, contract (shorten+copy), capturedAt, Replay/Live.
- `N observed swap events · M transactions · S-second span` — **event ≠ tx** ditegaskan.
- Headline: `TOP N SELLERS: x% OF ATTRIBUTED SELL USD` (D-3: default sell; toggle [Sell|Buy|All]).
- Tabel kontribusi: address (short+copy), Sell USD, Share, `Buy in sample` (`Observed $x` / `No buy observed` / `unavailable`), expand → events.
- Baris `No buy observed: x% of attributed sell USD · n sellers`.
- Depth curve panel: sparkline per-page (SVG minimal, no lib) + tabel angka; "sample sensitivity, not market change" caption.
- Sensitivity details: largest-event removal card.
- Method & sources drawer: methodVersion, parserVersion, receipts (endpoint, status, credits, hash prefix), field-quality summary, rejected rows.
- Breadth context panel (terpisah, timestamp sendiri): `but/sut/ut`, overlap hanya bila invariant lulus, label "provider-reported addresses, not people".
- Sell activity line: `n observed sells · sellability not tested`.
- History placeholder: `[History: unavailable — no second comparable time interval]`; watchlist `[not available in first prototype]`; copy observation link.

**Verify:** render wireframe §6 angka-persis pada fixture; semua state unavailable tampil (bukan blank/0).
**Audit:** checklist "5 hal bisa salah tafsir" — pembaca awam tidak bisa membaca "insider"/"can't sell" dari copy mana pun; review oleh user.

### Task C5 — Event inspector

- Per maker: list events (ts, side, usd, tx link bila `tx` valid — **tidak** pakai `h`), block, pool/factory label.
- Pagination lokal di client atas `MakerContribution.eventRefs`.

**Verify:** klik seller membuka events; tx link pergi ke explorer benar (format per chain).
**Audit:** row tanpa `tx` tidak membuat link rusak/404 — tampil `tx id unavailable`.

### Task C6 — Share card (next/og)

- Chain+contract, side, span, event count, capturedAt, "per reported address", headline number. Tanpa kata tuduhan; tanpa indikator aman/bahaya.

**Verify:** OG image render; vocab scan ikut men-scan string card.
**Audit:** kartu diperiksa mata — satu angka tanpa konteks window tidak boleh lolos desain.

> **Gate C check:** user test naratif — 1 pengguna (kamu) menjawab "siapa seller dominan, seberapa besar, apakah stabil" tanpa penjelasan developer; misread risk dicatat. Lulus → Phase D.

---

## PHASE D — Live operations (Gate D)

### Task D1 — Collector keyed production

- `/v1/dex/tokens/transactions`, `limit=100`, cursor `lastId` opaque, `endTime` frozen ms.
- Bounded: `maxPages` (env; evidence 30 feasible — default deep menunggu ukuran latency), deadline kolektor (default 30s), stop reasons lengkap termasuk `cursor_stalled` (cursor repeat / no progression).
- Boundary ties: `target_bound_reached` hanya setelah ties pada batas terlewati (spec §7).
- Retry hanya untuk transient (5xx/network) dengan backoff; 429 → `quota_limit`, tidak ada key rotation.
- Credits dihitung dari response header/body → `SourceReceipt.credits`.
- Ukur `c_endpoint` aktual pada keyed plan — catat di ENDPOINTS.md (capture keyless tidak mengukur debit paid).

**Verify:** live smoke JUP quick (≤3 pages, ≤~4 credits) — span/event counts masuk akal vs fixture historis; cursor_stalled dipicu pada stub test.
**Audit:** tidak ada header key di log; replay log membuktikan dedup boundary bekerja di live.

### Task D2 — Quota + cache + single-flight

- Per-IP per menit/hari + **atomic global credit budget** (keputusan D-1 — pilih store, implement via adapter `QuotaStore` interface agar swappable).
- Cache key: `chain|contract|requestedWindow|methodVersion|filterPolicy`; TTL default 45s; hit tidak mengubah capturedAt (freshness label tetap).
- Single-flight per scan key (concurrent identical scans share one in-flight fetch).

**Verify:** 2 request identik concurrent → 1 fetch provider; quota trip → labeled cached/unavailable response, bukan live palsu.
**Audit:** kill-switch env `MAKERHEAT_LIVE_OFF` → seluruh live path unavailable, replay tetap jalan.

### Task D3 — Storage + permalink

- Observation immutable (schemaVersion+methodVersion+parserVersion sebagai bagian identitas). Recompute metode baru → record baru, lama tetap replayable.
- Permalink = derived-only; write-acknowledged dulu baru link dikembalikan (D-2 store).
- Retention/deletion policy tertulis di CLAIMS.md sebelum durable link diaktifkan; raw bodies tidak ikut permalink.

**Verify:** round-trip permalink → JSON identik; stored record tidak bisa diubah (upsert→insert-only check).
**Audit:** grep seluruh route publik — tidak ada jalur yang membocorkan raw body / secret / internal path.

### Task D4 — Observability ops

- Structured logs (no secrets, no full key), metrics: credits/scan, 429 rate, p95 latency, cache hit ratio, pages/scan, stopReason distribution, concurrency, abort.
- Abort/cancel propagation dari request client ke collector loop.

**Verify:** `abort` di tengah deep scan → stopReason `provider_error`/`aborted` tercatat bersih, partial observation labeled.
**Audit:** satu sesi `pnpm dev` log review manual — tidak ada key/body mentah tercetak.

> **Gate D check:** live bounded smoke hijau + kuota/cache/concurrency terverifikasi + biaya aktual/scan terukur + permalink ack. Lulus → produk "v1 useful" selesai.

---

## PHASE E — History pilot (setelah v1 dipakai)

- Task E1: saved observations + non-overlap interval comparison (5-mnt windows, `endTime`-anchored); comparability status — dua interval terpotong berbeda = `partial`, bukan persistence.
- Task E2: watchlist storage + budget-aware refresh (math biaya spec §9 — 259k kredit/bln contoh harus dihindari via cadence/tier).
- Verify: dua capture nyata token sama → comparison record benar; Audit: interval-method sama dicek sebelum verdict "repeated" diterbitkan.

## PHASE F — Commercial pilot (HOLD sampai E+usefulness)

- Doc-only dulu: `docs/PILOT.md` — rubric jawaban benar, frozen observation, 15–20 user, $5–10/bln eksperimen, ukur waktu/correctness/misread/credits-per-user. Jangan bangun payment sebelum usefulness gate.

## PHASE G — AI opsional (deferred)

- Contract doc `docs/AI-CONTRACT.md`: Jev = yes/no atas proposisi observable ber-rubric (abstain wajib, output [0,1] + model/rubric version + input hash + deadline); DeepSeek = caption grounded hanya dari angka terkomputasi (validator: setiap angka di output harus ada di metric table); "consensus ≠ bukti lebih kuat"; AI down → hasil deterministik tetap utuh. **Tidak ada kode** sampai Gate D + API key ada (user supply DeepSeek; Jev `TYPESAFE_API_KEY`).

---

## PHASE H — Docs & packaging

- Task H1: `README.md` (apa/bukan-apa, quickstart, replay demo), `docs/ENDPOINTS.md` (req/resp nyata tersanitasi + credit cost terukur), `docs/FRICTION.md` (cap 50-row search, venue mixing, `mc` dirty, hld rusak, pagination semantics — feedback untuk CMC).
- Task H2: LICENSE/usage note internal: raw CMC bodies tidak dikomit ke repo publik; `fixtures/` real masuk `.gitignore` bila repo go-public (manifest hash tetap publik).
- Task H3 (opsional — keputusan user): submission packaging kalau hackathon masih dikejar lain waktu.

**Verify:** link docs hidup; `pnpm build && pnpm test && pnpm scan:vocab && verify:fixtures && verify:engine` satu command hijau.
**Audit akhir (wajib sebelum sebut "selesai"):** secrets scan (`git ls-files` × pola key), vocabulary scan seluruh output, data-rights review (tidak ada raw publik), reproduksi golden dari clone bersih, dependency audit (`pnpm audit`), dan re-baca CLAIMS.md vs implementasi aktual.

---

## Estimasi jujur (kalender, bukan jam)

Phase 0+A: ~1 hari · B: ~2 hari · C: ~2 hari · D: ~1–2 hari · H parsial: ~½ hari → **v1 useful ≈ 6–8 hari** (konsisten dengan koreksi review 1–2 minggu). E/F/G di luar itu.

## Risiko terbesar yang tersisa

1. **Hak data CMC** belum dikonfirmasi — menentukan apakah durable public link sah. Mitigasi: derived-only + retention policy; baca commercial agreement sebelum D3 go-live.
2. **`c_endpoint` belum diukur** di paid plan — biaya/scan bisa lebih mahal dari asumsi 1 kredit.
3. **Upper bound pagination** tidak diketahui — `cursor_exhausted` di suatu depth harus diperlakukan sebagai "provider exhausted", bukan "full history".
4. **`ma` semantics per chain** perlu diverifikasi pada fixture per-chain (A2) — maker yang hilang di satu chain mengubah seluruh lensa atribusi.
5. **Misread UX**: desain harus lolos Gate C manusia, bukan hanya vocab test.
