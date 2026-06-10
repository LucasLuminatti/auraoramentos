# Feature Research

**Domain:** B2B lighting-quote wizard — composite/modular + magnetic-track system assembly
**Researched:** 2026-06-10
**Confidence:** HIGH (derived from codebase analysis + domain knowledge of lighting spec practice)

---

## Context: What Exists Today vs What Is Missing

The current system handles a single composition pattern:
`SistemaIluminacao = fita LED + driver (required) + perfil (optional)`.

Everything that does not fit this model — modular profiles hosting sub-modules (SYSTEM MOLD 22 + MODULO DIFUSO), magnetic track systems (MAGNETO 22 48V, TINY MAGNETO/TINY MAG 24V) — enters the budget as flat `ItemLuminaria` entries. The system already detects the mismatch at add-time (toast warnings in `handleSelectProdutoLuminaria`) and post-hoc in `analisarMagneto48V`, but has no composition flow. Users must manually count modules, manually find the driver SKU, and manually add connectors/kits with no guard that the total wattage is within the chosen driver.

This gap is the direct source of 19 UAT complaints collected 2026-06-10.

---

## Taxonomy of Composite Systems (Luminatti product lines)

### Family A — Modular Profile Systems
- **SYSTEM MOLD 22** (sobrepor modular): a perfil that accepts interchangeable MODULO DIFUSO inserts.
- Each module segment needs its own fita LED slice + driver sized to that segment's load.
- Assembly: pick profile length → add N modules of chosen type → system auto-derives fita demand per module → driver sizing by total W of the run.
- Voltage: 24V (same as standard profiles).

### Family B — Magnetic Track 48V (MAGNETO 22)
- Surface-mount or recessed 48V track.
- Spots/modules snap on magnetically; each has a rated wattage.
- Driver: 100W (LM2343) or 200W (LM2344); if total load > 200W → multiple drivers/circuits.
- Mandatory accessories: Conector de Energia Direcional LM2338 (energy injector per track segment), Kit de Fixação LM2987 (recessed version).
- Voltage: 48V — incompatible with any 12V/24V driver.
- The existing `analisarMagneto48V()` function already computes total W and recommends driver but does not add items or prevent missing components.

### Family C — Magnetic Track 24V (TINY MAGNETO / TINY MAG)
- Smaller, 24V track system.
- Connector: LM3168 (preto) or LM3169 (branco) — functionally equivalent color variants.
- Kit de Fixação required for recessed version (same LM2987 or equivalent).
- Driver: external 24V driver (same pool as standard 24V fita drivers).
- All TINY line spots (even non-track) require a 24V driver, flagged by `sistema_magnetico === 'tiny_magneto'`.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that, once a "composite system" concept exists, users assume will work. Missing any of these makes the feature feel broken.

| Feature | Why Expected | Complexity | Dependency on Existing Logic | Notes |
|---------|--------------|------------|------------------------------|-------|
| **System type selector** — user picks "Sistema Modular", "Trilho Magnético 48V", "Trilho Magnético 24V", or "Fita Padrão" when creating a new system | Without this the assembly flow cannot branch; user has no way to declare intent | LOW | Extends `SistemaIluminacao` discriminator field (new `tipo` or `familia` flag); branches the UI in AmbienteCard | Single Select at system creation; can default to "Fita Padrão" to keep existing behaviour untouched |
| **Modular profile: module slots** — after picking a modular profile (SYSTEM MOLD family), user can add N module lines (each line: module SKU + quantity) | This is the core assembly unit; without it modules still enter as flat luminarias | MEDIUM | New `modulos: ItemModulo[]` array on a variant of `SistemaIluminacao`; `ItemModulo` is simpler than `ItemLuminaria` (no price violation flow initially) | Modules priced per unit; metragem derived from module size × qty |
| **Auto fita demand from modules** — fita requirement is computed as `sum(module_length × qty)` not entered manually | Users expect the tool to do the arithmetic; manual entry defeats the purpose of a wizard | MEDIUM | Extends `calcularDemandaFita()` to accept modular systems; metragemManual becomes irrelevant for modular type | Module catalog entries need a `comprimento_m` field in produtos |
| **Driver auto-sizing from total load** — once modules are chosen, system computes `totalW = sum(module_wm × comprimento_m × qty)`, then recommends minimum driver (first driver in catalog whose `potencia >= totalW × 1.05` at correct voltage) | This is the primary value of a composition flow vs flat entry | HIGH | Builds on existing `calcularConsumoW` + `calcularQtdDrivers` pattern; needs a "suggest driver" query against the produtos catalog | Voltage already enforced (driver.voltagem === fita.voltagem); for magnetic 48V use existing `analisarMagneto48V` logic promoted to actionable |
| **Mandatory component checklist** — system UI shows required accessories (connectors, kits) and marks them present/absent based on whether their SKUs exist in the current ambiente | Users saw toast warnings in v1.1 but no enforcement; they expect the checklist to feel resolved, not just warned | MEDIUM | Reads `ambiente.luminarias` for connector/kit SKUs; existing logic in `analisarMagneto48V` is the prototype | Rules differ by family: MAGNETO 48V needs LM2338; TINY MAG needs LM3168 or LM3169; SYSTEM MOLD has no mandatory connector |
| **"Add missing component" shortcut** — when a required connector/kit is absent, the checklist shows a button that pre-fills a new `ItemLuminaria` line with the correct SKU | Warnings alone create friction; users expect one-click resolution | LOW | Calls existing `addLuminaria()` with prefilled SKU; triggers `handleSelectProdutoLuminaria` to autofill description + price | Only applies to connector/kit items — SKUs are known constants per system family |
| **Voltage lock for magnetic 48V** — once a MAGNETO 22 track is in the system, driver selector filters to 48V only, and any attempt to add a non-48V driver is blocked | Voltage mismatch is the #1 source of real-world wiring errors; the guard already exists at selection time but is bypassed when type is not declared | LOW | Extends existing voltage-incompatibility guard in `handleSelectProdutoSistema`; same toast.error pattern; add `filtro="driver_48v"` variant to `useProdutoSearch` | Currently the guard only fires if both fita.voltagem and driver.voltagem are already set; modular system declares voltage at type-selection time |
| **Correct product filtro for magnetic components** — searching for connectors/kits/drivers within the system shows only family-appropriate results | The UAT feedback explicitly names `tipo_produto` mismatch causing items to vanish (LM3475, LM3291, WALL WASHER, CANTONEIRA) | MEDIUM | Fix `useProdutoSearch` filter logic; add `tipo_produto` values (`conector`, `kit_fixacao`) if missing from catalog; verify DB `tipo_produto` coverage for the families | This is partly a data-quality issue (catalog tagging) + partly a query filter fix |

### Differentiators (Competitive Advantage)

Features that go beyond correctness and make the tool genuinely better than a spreadsheet.

| Feature | Value Proposition | Complexity | Dependency | Notes |
|---------|-------------------|------------|------------|-------|
| **Driver recommendation panel with "apply" button** — after calculating total load, system shows the exact recommended driver SKU + qty and offers a one-click apply that populates the driver fields | Saves the user from looking up the driver SKU manually; turns passive advice into action | MEDIUM | Extends `analisarMagneto48V` recommendation logic; needs a catalog query for driver SKU by potencia+voltagem; adds `onApplyDriver` callback to the recommendation card | High payoff; 48V logic already half-done in `ResumoMagneto48V.driverRecomendado` |
| **Module count → cable length estimator** — for TINY MAG/MAGNETO tracks, derives total track length from modules and shows it as a hint in the metragem field | Electricians use track length to size cable runs; this surfacing adds spec credibility | LOW | Purely derived display from `sum(module.comprimento_m × qty)`; no new state | Low effort, visible payoff in PDF |
| **System duplication across ambientes** — clone an assembled composite system (with all modules, driver, connectors) into a different ambiente | UAT feedback item explicitly requested this; saves re-assembly time on multi-room projects | MEDIUM | Needs a `duplicarSistema(sistemaId, targetAmbienteId)` action; deep-clones the composite state with new UUIDs | Works for all system types, not just composite |
| **PDF section "Sistemas Compostos"** — PDF v3 renders modular/magnetic systems as a structured block (track SKU + qty, modules table, driver qty, required accessories) instead of a flat luminaria list | Client-facing deliverable is the main artifact; seeing the system assembled in the PDF validates the spec | HIGH | New PDF template section; extends `gerarPdfHtml.ts`; needs v1/v2/v3 router extension | Deferred to a dedicated PDF phase; do not block wizard functionality |
| **Warn before advancing step 2 → step 3 if composite system has unresolved components** — block or warn if a magnetic track has no driver or no connector | Catches the most common incomplete-spec error before it reaches the PDF | LOW | Guard in `Step2Ambientes` advance handler; checks `analisarMagneto48V(amb).avisos.length > 0` per ambiente | Already partially implemented via toast on product select; needs a gate at step transition |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full BOM (Bill of Materials) editor** — spreadsheet-style grid for every component across all systems | Users want everything in one place | Scope creep; AURA's value is guided assembly, not a general BOM tool; building a grid duplicates the wizard with worse UX | Stick to the wizard card pattern; the Step3 table already gives a flat BOM view at review time |
| **Automatic splitting of 48V circuits** — tool auto-partitions modules into circuits when total W > 200W | Seems helpful; saves manual calculation | Circuit topology depends on physical room layout that the tool does not model; auto-split will produce wrong results for non-linear runs | Show the `múltiplos drivers` warning (already in `analisarMagneto48V`) and let the user manually add a second track + driver |
| **Per-module dimming/CCT configuration** — let user set dimming profile or color temperature per module | Power users want it | Overfits to advanced spec; Luminatti's quote is a price document, not a full light design; this data is not priced separately | Record temperature/IRC in the module's product description (already done via `construirDescricaoRica`) |
| **Generic 48V track support for third-party modules** — allow non-Luminatti modules on MAGNETO track | Users want flexibility | Opens a support nightmare (wattage data unreliable, connector compatibility unknown); price data unavailable | Gate entry to catalog SKUs only; non-catalog items enter as flat luminarias with no auto-sizing |
| **Multi-voltage track in same sistema** — mix 24V and 48V modules in one system | Edge case some projects need | Electrically impossible (track voltage is fixed); UI that permits this creates real wiring errors | Hard block: voltage is declared at system-type selection and locked |

---

## Feature Dependencies

```
[System Type Selector]
    └──required-by──> [Modular Module Slots]
    └──required-by──> [Voltage Lock 48V]
    └──required-by──> [Correct Product Filtro]

[Modular Module Slots]
    └──required-by──> [Auto Fita Demand from Modules]
    └──required-by──> [Driver Auto-Sizing from Total Load]

[Driver Auto-Sizing from Total Load]
    └──enables──> [Driver Recommendation Panel with Apply Button]

[Mandatory Component Checklist]
    └──enables──> [Add Missing Component Shortcut]
    └──enables──> [Warn Before Advancing Step 2→3]

[Driver Recommendation Panel with Apply Button]
    └──enhances──> [Warn Before Advancing Step 2→3]

[System Duplication]
    ──depends-on──> [Modular Module Slots] (needs complete state shape before deep-clone)

[PDF Section Sistemas Compostos]
    ──depends-on──> [all table-stakes features] (needs stable data shape)
    ──depends-on──> [PDF v2 template] (already exists; v3 extends it)
```

### Dependency Notes

- **System Type Selector requires Modular Module Slots:** The selector is only useful if it branches into a different assembly flow. Building the selector without the module slots produces a dead branch.
- **Auto Fita Demand requires Modular Module Slots:** `calcularDemandaFita` currently reads `perfil.comprimentoPeca × perfil.quantidade × passadas`. For modular systems, the input is `sum(modulo.comprimento_m × qty)` — the overload signature must be added alongside the data model.
- **Driver Auto-Sizing requires correct module wattage data:** The `Produto` record needs a reliable `driver_potencia_w` (mapped from `potencia_watts`) for module items. For 48V MAGNETO modules this field already exists in the schema and is already read by `analisarMagneto48V`. For SYSTEM MOLD modules this field may need catalog population.
- **Voltage Lock conflicts with current default 24V:** Today `addSistema()` initializes both fita and driver to 24V. When system type is MAGNETO 48V, initialization must override to 48V and restrict the catalog filter.
- **PDF section is a downstream consumer:** All upstream data shape decisions lock the PDF's structure. Defer PDF work until wizard state is stable to avoid double rewrites.

---

## MVP Definition (v1.2 scope)

### Launch With (v1.2 wizard correctness)

Minimum set that resolves UAT complaints and removes the "flat luminaria workaround."

- [ ] **System Type Selector** — branch point for all composite flows
- [ ] **Magnetic 48V composition flow** — MAGNETO 22 track + modules + mandatory LM2338 connector checklist + driver auto-sizing promoted from `analisarMagneto48V` warning to actionable recommendation
- [ ] **Magnetic 24V composition flow** — TINY MAG track + modules + LM3168/LM3169 checklist + 24V driver sizing
- [ ] **Voltage lock** — 48V track locks driver filter; 24V flow uses existing voltage guard
- [ ] **"Add missing component" shortcut** — one-click connector/kit addition from checklist
- [ ] **Warn at step transition** — block advance if magnetic system has no driver or no connector
- [ ] **Catalog filtro fix** — `tipo_produto` tagging for connectors/kits so they appear in search results (data + query fix)

### Add After Validation (v1.2+)

- [ ] **SYSTEM MOLD modular profile flow** — lower urgency than magnetic; no safety risk, just inconvenience; add after magnetic track is validated
- [ ] **Driver recommendation "apply" button** — upgrade the recommendation panel that already exists in `ResumoMagneto48V` from display to actionable
- [ ] **System duplication across ambientes** — UAT-requested; deferred until composite state shape is finalized

### Future Consideration (v2+)

- [ ] **PDF v3 "Sistemas Compostos" section** — defer until wizard is stable; requires PDF template overhaul
- [ ] **Motor de cálculo v1 refactor** — spec already closed in `.planning/notes/motor-calculo-led-spec.md`; Marco 3; do not conflate with v1.2 composite flow

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| System Type Selector | HIGH | LOW | P1 |
| Magnetic 48V composition flow (MAGNETO 22) | HIGH | MEDIUM | P1 |
| Magnetic 24V composition flow (TINY MAG) | HIGH | MEDIUM | P1 |
| Voltage lock (48V) | HIGH | LOW | P1 |
| "Add missing component" shortcut | HIGH | LOW | P1 |
| Catalog filtro fix (tipo_produto) | HIGH | LOW | P1 |
| Warn before advancing step 2→3 | MEDIUM | LOW | P1 |
| Driver recommendation "apply" button | HIGH | MEDIUM | P2 |
| System duplication across ambientes | MEDIUM | MEDIUM | P2 |
| SYSTEM MOLD modular profile flow | MEDIUM | HIGH | P2 |
| PDF v3 Sistemas Compostos section | MEDIUM | HIGH | P3 |
| Motor de cálculo v1 refactor | LOW (v1.2) | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.2 to resolve UAT complaints
- P2: Should have; add when P1 is stable
- P3: Defer; own milestone

---

## Driver Sizing Behavior — Concrete Rules by System Family

This section describes the exact expected computation behavior for the roadmapper/implementer.

### Standard fita (existing, unchanged)
```
consumoW = metragem × passadas × wm
qtdPotencia = ceil(consumoW × 1.05 / driver.potencia)
qtdExtensao = ceil(metragem / limiteExtensao(voltagem))   // 12V→5m, 24V→10m, 48V→null
qtdDrivers  = max(qtdPotencia, qtdExtensao)
```

### MAGNETO 22 (48V) — composite
```
modules = luminarias in ambiente where sistema_magnetico === 'magneto_48v'
         AND not (TRILHO|CONECTOR|DRIVER|KIT in descricao)
potenciaTotal = sum(module.potencia_watts × module.quantidade)
potenciaSegura = potenciaTotal × 1.05
→ if potenciaSegura ≤ 100W : driver = LM2343 (100W), qtd = 1
→ if potenciaSegura ≤ 200W : driver = LM2344 (200W), qtd = 1
→ if potenciaSegura > 200W : warning "múltiplos drivers" + qtd = ceil(potenciaSegura / 200)
Required: LM2338 connector (≥1 per track segment)
Required (recessed): LM2987 kit
Voltage: always 48V — hard lock
```
(Current `analisarMagneto48V` already computes this. The gap is: it only warns, does not compose.)

### TINY MAG / TINY MAGNETO (24V) — composite
```
modules = luminarias in ambiente where sistema_magnetico === 'tiny_magneto'
potenciaTotal = sum(module.potencia_watts × module.quantidade)
potenciaSegura = potenciaTotal × 1.05
driver = smallest 24V driver in catalog with potencia ≥ potenciaSegura
Required: LM3168 (preto) OR LM3169 (branco) — at least one per track
Required (recessed): kit de fixação
Voltage: always 24V — uses existing 24V driver pool
Extension limit: 10m (standard 24V rule applies)
```

### SYSTEM MOLD 22 (modular profile, 24V) — composite
```
modules = module_slots[] (new concept, not in ambiente.luminarias)
metragemFita = sum(modulo.comprimento_m × modulo.quantidade)
consumoW = metragemFita × fita.wm
→ applies standard 24V sizing rules (same as existing SistemaIluminacao)
No mandatory connector beyond standard driver terminals
Voltage: 24V
```

---

## Relationship to Existing Code

| Current artifact | v1.2 interaction |
|-----------------|-----------------|
| `SistemaIluminacao` interface | Extend with optional `tipo: 'padrao' | 'modular' | 'magneto_48v' | 'tiny_magneto'` discriminator + optional `modulos: ItemModulo[]` array |
| `analisarMagneto48V(amb)` | Promote from warning-only to composition engine: same wattage logic, new "apply driver" + "add connector" action callbacks |
| `calcularDemandaFita()` | Add overload for modular sistema: `sum(modulo.comprimento_m × qty)` |
| `calcularConsumoW()` | Same overload addition |
| `calcularQtdDrivers()` | Magnetic 48V has different sizing table (100W/200W buckets) vs linear formula; needs special branch or the magnetic systems bypass this fn entirely and use `analisarMagneto48V` |
| `handleSelectProdutoLuminaria` | Remove duplicate responsibility for magnetic warnings; those move to the composition flow |
| `handleSelectProdutoSistema` | Voltage lock extension; add 48V branch |
| `useProdutoSearch` (filtro) | Add `filtro='conector'`, `filtro='kit_fixacao'` for component search; fix existing `filtro='luminaria'` OR clause to include the missing `tipo_produto` values |
| `ValidacaoPanel` + `useValidarSistemas` | Edge fn `validar-sistema-orcamento` needs new `tipo_sistema` branches; currently only detects 48V by voltage, not by explicit family |
| `gerarPdfHtml.ts` | No change in v1.2; composite systems remain in luminarias section until PDF v3 |

---

## Sources

- Codebase analysis: `src/types/orcamento.ts`, `src/components/AmbienteCard.tsx`, `src/hooks/useProdutoSearch.ts`, `src/hooks/useValidarSistemas.ts`
- Domain spec: `.planning/notes/motor-calculo-led-spec.md` (motor v1 spec, Marco 3 — explicitly out of scope for v1.2)
- UAT origin: PROJECT.md v1.2 milestone definition ("19 pontos com prints, 2026-06-10")
- Product family knowledge: Luminatti catalog as described in AmbienteCard toast rules (MAGNETO 22 SKUs: LM2343/LM2344/LM2338/LM2987; TINY MAG: LM3168/LM3169)
- Confidence: HIGH for magnetic track families (SKUs named explicitly in code); MEDIUM for SYSTEM MOLD (family named in UAT feedback but no SKUs hardcoded in existing code)

---

*Feature research for: AURA v1.2 — composite/modular + magnetic-track lighting systems*
*Researched: 2026-06-10*
