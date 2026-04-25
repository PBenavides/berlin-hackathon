# Data — WEG Immanuelkirchstraße 26, Berlin

Property management dataset for a 3-building WEG (52 units, 35 owners, 26 tenants, 16 service providers).

---

## Folder Structure

```
data/
├── stammdaten/          # Master data — entities & relationships
├── bank/                # Bank statements
├── briefe/              # Outbound letters (PDF, by month)
├── emails/              # Inbound/outbound emails (.eml, by month)
├── rechnungen/          # Invoices from service providers (PDF, by month)
└── incremental/         # Daily delta feeds (day-01 … day-10)
```

---

## stammdaten/ — Master Data

Core relational data for the property. All FK references are valid.

| File | Rows | Description |
|---|---|---|
| `stammdaten.json` | — | Property + 3 buildings (id, hausnr, etagen, fahrstuhl, baujahr) |
| `einheiten.csv` | 52 | Units: id, **haus_id**, typ, wohnflaeche_qm, miteigentumsanteil |
| `eigentuemer.csv` | 35 | Owners: id, name/firma, sprache, **einheit_ids** (`;`-separated), beirat, sev_mandat |
| `mieter.csv` | 26 | Tenants: id, **einheit_id**, **eigentuemer_id**, mietbeginn/ende, kaltmiete, nk_vorauszahlung, kaution |
| `dienstleister.csv` | 16 | Vendors: id, branche, vertrag_monatlich, stundensatz |
| `analysis.ipynb` | — | Exploratory analysis notebook |

**Entity relationships:**
```
Liegenschaft (1) → Gebäude (3) → Einheiten (52)
                                      ├── Eigentümer (35)  via eigentuemer.einheit_ids
                                      └── Mieter (26)      via mieter.einheit_id + mieter.eigentuemer_id
Dienstleister (16)  — no FK; linked by service category
```

---

## bank/

| File | Description |
|---|---|
| `kontoauszug_2024_2025.csv` | Bank statement (flat CSV) |
| `kontoauszug_2024_2025.camt053.xml` | Same statement in CAMT.053 (ISO 20022) format |
| `bank_index.csv` | Index of transactions |

---

## briefe/ — Letters

135 PDFs, monthly folders from `2024-04` to `2025-12`.

Filename pattern: `YYYYMMDD_<type>_LTR-NNNN.pdf`

Types seen: `etv_einladung` (owner meeting invites), `etv_protokoll` (meeting minutes), `mahnung` (payment reminders).

---

## emails/

~6,500 `.eml` files, monthly folders from `2024-01` to `2026-01`.

Filename pattern: `YYYYMMDD_HHMMSS_EMAIL-NNNNN.eml`

---

## rechnungen/ — Invoices

194 PDFs, monthly folders from `2024-01` to `2025-12`.

Filename pattern: `YYYYMMDD_<vendor-id>_INV-NNNNN.pdf`  
Vendor IDs (e.g. `DL-001`, `DL-005`) map to `dienstleister.csv`.

---

## incremental/

10 daily delta snapshots (`day-01` … `day-10`), each mirroring the same structure:

```
day-XX/
├── incremental_manifest.json
├── emails_index.csv
├── bank/
│   ├── bank_index.csv
│   └── kontoauszug_delta.csv
├── emails/2026-01/
└── rechnungen/2026-01/
```

Used for simulating day-by-day data ingestion.
