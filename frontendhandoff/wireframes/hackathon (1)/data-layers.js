// Layered context: Vendors > Owners > Buildings > Properties
// Plus PDF Extract events and Hermes chat threads
window.BUENA_LAYERS = {

  // =================================================================
  // OWNERS — top-level context, fan out to multiple properties
  // =================================================================
  owners: [
    {
      id: "o1",
      name: "WEG Gartenstraße 42",
      type: "WEG", // condominium owners' association
      contact: "Herr Klein (Verwaltungsbeirat)",
      email: "klein@weg-gartenstrasse42.de",
      phone: "+49 30 5550 1142",
      iban_last4: "8821",
      since: "2014",
      properties: ["p1"],
      portfolioRevenueYTD: 318400,
      contracts: [
        { id: "c1", title: "Property management agreement", status: "active", until: "2027-12-31", file: "owner_pma_2024.pdf" },
        { id: "c2", title: "HVAC service contract — Heinz GmbH", status: "active", until: "2026-12-31", file: "wartungsvertrag-heinz-2024.pdf" }
      ],
      decisions: [
        { ts: "2026-04-22 14:08", text: "Approved budget for cellar window replacement (2027 line item) — €18,000." },
        { ts: "2026-03-12 11:20", text: "Authorized lobby-door closer replacement (under-spec model) — vendor TBD." },
        { ts: "2026-02-04 16:48", text: "AGM minutes ratified. Quorum 64%. Verwaltungsbeirat re-elected (Herr Klein)." }
      ],
      // What the AI knows about this owner that applies across all their buildings
      contextNotes: [
        "Approval threshold: any single repair > €1,000 requires written board sign-off.",
        "Communication preference: German Sie-Form, formal. Always cc h.klein@weg-gartenstrasse42.de.",
        "AGM: annually in February. Reserve fund decisions deferred until AGM.",
        "Vendor preference: Heinz GmbH for HVAC, Maler Krüger for paint."
      ]
    },
    {
      id: "o2",
      name: "Linien 88 GbR",
      type: "GbR",
      contact: "Frau Hoffmann (Geschäftsführerin)",
      email: "hoffmann@linien88.de",
      phone: "+49 30 5550 1188",
      iban_last4: "1188",
      since: "2019",
      properties: ["p2"],
      portfolioRevenueYTD: 142800,
      contracts: [
        { id: "c3", title: "Property management agreement", status: "active", until: "2026-09-30", file: "linien88_pma.pdf" },
        { id: "c4", title: "Cleaning contract — RBM Berlin", status: "active", until: "2026-12-31", file: "rbm_2025.pdf" }
      ],
      decisions: [
        { ts: "2026-04-15 09:14", text: "Approved Q2 facade pressure-wash — 2 buildings, €4,200 total." },
        { ts: "2026-01-22 10:00", text: "Quarterly P&L review. NOI tracking +3.2% vs plan." }
      ],
      contextNotes: [
        "Decision-making: Frau Hoffmann signs off solo up to €5,000.",
        "Reporting: monthly P&L by 5th of next month.",
        "Tax: VAT-exempt (Kleinunternehmer)."
      ]
    },
    {
      id: "o3",
      name: "Kastanienallee Holdings UG",
      type: "UG",
      contact: "Mr. Otto (CFO)",
      email: "otto@kastanien-holdings.de",
      phone: "+49 30 5550 1112",
      iban_last4: "0012",
      since: "2021",
      properties: ["p3"],
      portfolioRevenueYTD: 612000,
      contracts: [
        { id: "c5", title: "Property management agreement", status: "active", until: "2028-06-30", file: "kastanien_pma.pdf" },
        { id: "c6", title: "Lift service contract — Lift-Service Berlin", status: "active", until: "2027-03-31", file: "lift_kastanien.pdf" }
      ],
      decisions: [
        { ts: "2026-04-23 17:00", text: "Lift Tower B major service approved — €11,400, vendor Lift-Service Berlin." },
        { ts: "2026-03-08 15:22", text: "Refinancing closed. New mortgage rate 3.4% fixed 7yr." }
      ],
      contextNotes: [
        "Investor reporting: quarterly to LP group.",
        "Approval matrix: any capex > €10,000 requires CFO + board chair.",
        "Sustainability: ESG report annually (March)."
      ]
    }
  ],

  // =================================================================
  // BUILDINGS — physical structure context, sits between owner & property
  // (in this MVP one building == one property, but the layer is real
  //  because building-level context (heating, vendors attached, history)
  //  applies regardless of which units you're looking at)
  // =================================================================
  buildings: [
    {
      id: "b1",
      propertyId: "p1",
      name: "Gartenstraße 42",
      year: 1908,
      restored: 2003,
      heating: "Central gas (Viessmann Vitodens 200-W, 2023)",
      attachedVendors: ["v1", "v3", "v5"], // Heinz, Schulz, RBM cleaning
      pastCases: [
        { id: "bc-1", date: "2025-11-12", title: "Boiler annual service", vendor: "Heinz GmbH", outcome: "OK · €420" },
        { id: "bc-2", date: "2025-09-04", title: "Roof leak — Unit 7A", vendor: "Dachdecker Mertens", outcome: "Resolved · €2,840" },
        { id: "bc-3", date: "2025-07-18", title: "Lift inspection (TÜV)", vendor: "TÜV Rheinland", outcome: "Pass" },
        { id: "bc-4", date: "2025-05-02", title: "Cellar pump replacement", vendor: "Klempner Bauer", outcome: "Resolved · €1,180" }
      ],
      events: [
        { ts: "2026-04-25 14:32", text: "Recurring damp patch reported in Unit 2B (3rd time this year)." },
        { ts: "2026-04-02 09:00", text: "Spring inspection complete. 2 minor items logged in Known Issues." },
        { ts: "2026-01-15 11:00", text: "Lobby door closer replaced (under-spec — flagged for re-replace)." }
      ],
      // Building-level facts the AI propagates to every property under it
      contextNotes: [
        "Built 1908, restored 2003. Listed building (Denkmalschutz) — exterior changes need permit.",
        "North-facing units (2B, 3B, 4A, 6B) have original 1990s radiator valves — known to seize.",
        "Cellar window seals leak in heavy rain. Patched. Full replacement budgeted 2027.",
        "Lobby door closer is under-spec for door weight. Replacement Q2."
      ]
    },
    {
      id: "b2",
      propertyId: "p2",
      name: "Linienstraße 88",
      year: 1925,
      restored: 2011,
      heating: "District heating (Vattenfall)",
      attachedVendors: ["v1", "v3", "v5"],
      pastCases: [
        { id: "bc-5", date: "2026-02-14", title: "Cellar door lock replaced", vendor: "Schulz & Söhne", outcome: "Resolved · €380" },
        { id: "bc-6", date: "2025-12-01", title: "District heating swap — main valve", vendor: "Vattenfall", outcome: "Resolved (no charge)" }
      ],
      events: [
        { ts: "2026-04-24 09:14", text: "Cellar door won't lock — escalated to vendor agent." }
      ],
      contextNotes: [
        "District heating supplier: Vattenfall. Outage hotline +49 30 4400 8000.",
        "Bicycle shed has 22 spaces, allocation managed by Frau Hoffmann directly.",
        "No lift — 4 floors walk-up."
      ]
    },
    {
      id: "b3",
      propertyId: "p3",
      name: "Kastanienallee 12",
      year: 1972,
      restored: 2018,
      heating: "Central gas + heat pumps (hybrid, 2018)",
      attachedVendors: ["v1", "v2", "v3", "v5"],
      pastCases: [
        { id: "bc-7", date: "2026-03-20", title: "Lift outage Tower A", vendor: "Lift-Service Berlin", outcome: "Resolved · €2,150 · 6h downtime" },
        { id: "bc-8", date: "2025-10-05", title: "Heat pump COP audit", vendor: "Klimatec", outcome: "OK · firmware updated" },
        { id: "bc-9", date: "2025-06-22", title: "Garage gate sensor", vendor: "Tor-Service GmbH", outcome: "Resolved · €640" }
      ],
      events: [
        { ts: "2026-04-25 13:30", text: "Lift outage Tower B — vendor agent dispatched." },
        { ts: "2026-04-23 17:00", text: "Owner approved €11,400 major service for lifts." }
      ],
      contextNotes: [
        "Two towers (A, B), 22 units total, 1 commercial unit (ground floor café).",
        "Lifts: Schindler 5500 series (2018). Service contract with Lift-Service Berlin.",
        "Hybrid heating: gas peaks Nov–Feb, heat pumps shoulder seasons.",
        "Café tenant: separate commercial lease, weekly trash collection from rear yard."
      ]
    }
  ],

  // =================================================================
  // VENDOR CASES — attach historical job records to each vendor
  // =================================================================
  vendorCases: {
    v1: [ // Heinz GmbH
      { id: "vc-1", date: "2025-11-12", property: "p1", title: "Boiler annual service", outcome: "OK", cost: 420, slaMet: true },
      { id: "vc-2", date: "2026-01-22", property: "p1", title: "Valve replacement Unit 4A", outcome: "OK", cost: 198, slaMet: true },
      { id: "vc-3", date: "2026-02-09", property: "p2", title: "Heating cold Unit 3", outcome: "OK", cost: 165, slaMet: true },
      { id: "vc-4", date: "2026-03-15", property: "p1", title: "Valve replacement Unit 6B", outcome: "OK", cost: 179, slaMet: true },
      { id: "vc-5", date: "2026-04-14", property: "p1", title: "Valve replacement Unit 7A (recurring)", outcome: "OK", cost: 165, slaMet: true },
      { id: "vc-6", date: "2026-04-22", property: "p1", title: "Boiler pressure low Unit 7A", outcome: "In progress", cost: null, slaMet: null }
    ],
    v2: [ // Maler Krüger
      { id: "vc-7", date: "2025-08-04", property: "p3", title: "Stairwell repaint Tower A", outcome: "OK", cost: 3850, slaMet: true },
      { id: "vc-8", date: "2025-11-22", property: "p1", title: "Lobby touch-ups", outcome: "Late by 5d", cost: 480, slaMet: false },
      { id: "vc-9", date: "2026-04-02", property: "p1", title: "Quote: balcony repaint €4,200", outcome: "Rejected (over threshold)", cost: 0, slaMet: null }
    ],
    v3: [ // Schulz & Söhne
      { id: "vc-10", date: "2025-09-12", property: "p2", title: "Hallway lights 2F", outcome: "OK", cost: 220, slaMet: true },
      { id: "vc-11", date: "2026-02-14", property: "p2", title: "Cellar door lock", outcome: "OK", cost: 380, slaMet: true },
      { id: "vc-12", date: "2026-04-23", property: "p1", title: "Hallway lights flickering 2F", outcome: "Slot proposed", cost: null, slaMet: null }
    ],
    v4: [ // Klempner Bauer
      { id: "vc-13", date: "2025-05-02", property: "p1", title: "Cellar pump replacement", outcome: "OK · late", cost: 1180, slaMet: false },
      { id: "vc-14", date: "2026-04-21", property: "p1", title: "Kitchen faucet drip Unit 4A", outcome: "Awaiting tenant slot", cost: null, slaMet: null }
    ],
    v5: [ // RBM Cleaning
      { id: "vc-15", date: "2026-04-22", property: "p1", title: "Weekly cleaning", outcome: "OK", cost: 240, slaMet: true },
      { id: "vc-16", date: "2026-04-22", property: "p2", title: "Weekly cleaning", outcome: "OK", cost: 180, slaMet: true },
      { id: "vc-17", date: "2026-04-22", property: "p3", title: "Weekly cleaning", outcome: "OK", cost: 320, slaMet: true }
    ],
    v6: [ // Wagner (blocked)
      { id: "vc-18", date: "2026-03-04", property: "p1", title: "Window won't close Unit 6B (1st attempt)", outcome: "Missed appt", cost: 0, slaMet: false },
      { id: "vc-19", date: "2026-03-18", property: "p1", title: "Window won't close Unit 6B (2nd attempt)", outcome: "Missed appt", cost: 0, slaMet: false },
      { id: "vc-20", date: "2026-04-08", property: "p1", title: "Window won't close Unit 6B (3rd attempt)", outcome: "No-show — vendor blocked", cost: 0, slaMet: false }
    ]
  },

  // =================================================================
  // PDF EXTRACT — recent uploads, agent routes to layer
  // =================================================================
  pdfExtracts: [
    {
      id: "pdf-12",
      filename: "AGM-minutes-2026-Q1.pdf",
      uploadedBy: "maria@buena.io",
      uploadedAt: "2026-04-25 14:08",
      pages: 14,
      sizeKb: 1840,
      status: "applied",
      detectedLayers: [
        { layer: "owner", target: "o1", confidence: 0.97, chunks: 6, summary: "AGM minutes for WEG Gartenstraße 42. Resolutions: cellar window budget €18k (2027), Verwaltungsbeirat re-elected." },
        { layer: "building", target: "b1", confidence: 0.84, chunks: 2, summary: "Building-level: cellar window full replacement scheduled 2027." },
        { layer: "property", target: "p1", confidence: 0.71, chunks: 1, summary: "Updated approval threshold context — €1,000 board sign-off." }
      ]
    },
    {
      id: "pdf-11",
      filename: "Heinz-invoice-GAR42-Apr.pdf",
      uploadedBy: "system",
      uploadedAt: "2026-04-24 09:32",
      pages: 2,
      sizeKb: 240,
      status: "applied",
      detectedLayers: [
        { layer: "vendor", target: "v1", confidence: 0.99, chunks: 3, summary: "Heinz GmbH invoice. Job: Unit 7A valve replacement. €165. SLA met." },
        { layer: "building", target: "b1", confidence: 0.62, chunks: 1, summary: "Past case logged: 2026-04-14 valve replacement Unit 7A." }
      ]
    },
    {
      id: "pdf-10",
      filename: "Lift-Service-quote-Tower-B.pdf",
      uploadedBy: "otto@kastanien-holdings.de",
      uploadedAt: "2026-04-23 16:51",
      pages: 4,
      sizeKb: 480,
      status: "review",
      detectedLayers: [
        { layer: "owner", target: "o3", confidence: 0.94, chunks: 2, summary: "Capex quote €11,400 — major lift service. Above CFO solo threshold (€10k) → requires board chair sign-off." },
        { layer: "building", target: "b3", confidence: 0.88, chunks: 3, summary: "Tower B lift service contract reference." },
        { layer: "vendor", target: "v_lift_service", confidence: 0.79, chunks: 1, summary: "Lift-Service Berlin — to add to vendor directory if accepted." }
      ]
    },
    {
      id: "pdf-9",
      filename: "Wartungsvertrag-Heinz-2024.pdf",
      uploadedBy: "maria@buena.io",
      uploadedAt: "2026-01-20 10:14",
      pages: 8,
      sizeKb: 920,
      status: "applied",
      detectedLayers: [
        { layer: "vendor", target: "v1", confidence: 0.98, chunks: 5, summary: "HVAC service contract terms. 24h emergency, €420 annual flat + parts." },
        { layer: "owner", target: "o1", confidence: 0.81, chunks: 1, summary: "Contract signatory: WEG Gartenstraße 42." }
      ]
    }
  ],

  // =================================================================
  // HERMES CHAT — small chat to govern context decisions
  // The agentic decisions are out of scope for the UI, the UI just
  // confirms that some context chunk was extracted/applied/finished.
  // =================================================================
  hermesThreads: [
    {
      id: "ht-1",
      scope: { layer: "owner", id: "o1", label: "WEG Gartenstraße 42" },
      messages: [
        { ts: "14:08:11", role: "user", text: "Apply the AGM minutes I just uploaded. Make sure the €1,000 board threshold is captured at the owner level." },
        { ts: "14:08:14", role: "agent", text: "Working. I parsed AGM-minutes-2026-Q1.pdf (14 pages). 9 chunks extracted across owner, building, property layers.", system: true },
        { ts: "14:08:21", role: "agent", text: "Owner-level update queued: \"Approval threshold: any single repair > €1,000 requires written board sign-off.\" Confidence 0.97." },
        { ts: "14:08:32", role: "user", text: "Approve all owner-level chunks. Hold building-level for my review." },
        { ts: "14:08:35", role: "agent", text: "Confirmed. 6 owner chunks committed → o1 context. 2 building chunks pending review (b1).", system: true, confirms: ["chunk applied", "chunk applied", "chunk applied", "chunk applied", "chunk applied", "chunk applied"] }
      ]
    },
    {
      id: "ht-2",
      scope: { layer: "vendor", id: "v1", label: "Heinz GmbH" },
      messages: [
        { ts: "10:42:01", role: "user", text: "Heinz raised their hourly rate. Update vendor context." },
        { ts: "10:42:04", role: "agent", text: "Got it. What's the new rate, and effective date?", system: false },
        { ts: "10:43:18", role: "user", text: "€95/hr from May 1. Same emergency line and SLA." },
        { ts: "10:43:21", role: "agent", text: "Vendor v1 context updated. New chunk: \"Hourly rate €95 (eff. 2026-05-01). Emergency line and 24h SLA unchanged.\" Propagating to estimate models for HVAC tickets.", system: true, confirms: ["chunk applied", "estimates refreshed"] }
      ]
    },
    {
      id: "ht-3",
      scope: { layer: "building", id: "b1", label: "Gartenstraße 42" },
      messages: [
        { ts: "16:14:08", role: "user", text: "We had a flood in cellar last winter, never logged. Add a building note." },
        { ts: "16:14:11", role: "agent", text: "Got it. Adding to building b1: \"Cellar flood (winter 2024–25). Cause: cellar window seal failure. Patched. Full replacement budgeted 2027.\" Should I cross-reference the AGM resolution that approved the 2027 budget?" },
        { ts: "16:14:42", role: "user", text: "Yes please." },
        { ts: "16:14:44", role: "agent", text: "Done. Building note linked to owner decision (AGM Q1 2026, €18k cellar window line). 1 chunk applied to b1, 1 cross-ref to o1.", system: true, confirms: ["chunk applied", "cross-ref linked"] }
      ]
    }
  ]
};
