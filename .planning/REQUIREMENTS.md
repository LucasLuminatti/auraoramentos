# Requirements — Milestone v1.3

**Milestone:** v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)
**Opened:** 2026-06-12
**Status:** Roadmap ready

> Origem: comentários UAT 8, 9, 11 e parte do 10 (montagem de sistemas compostos), movidos da v1.2 por serem evolução estrutural (~40% do esforço e ~todo o risco). Pesquisa de suporte em `.planning/research/` (STACK/FEATURES/ARCHITECTURE/PITFALLS, 2026-06-10, HIGH confidence) — reusada integralmente. **Escopo travado:** apenas o domínio de sistemas compostos; PDF vetorial (999.1) e Preços/Margem ficam como marcos próprios. **Diretrizes:** Fita Padrão intocada · arquitetura aditiva e conservadora · driver assistido mas auditável · validações não-bloqueantes · PDF v3 como camada nova sem arriscar v2 · sem ampliar escopo além da pesquisa.

---

## Active Requirements (v1.3)

### SIST — Montagem de sistemas compostos

- [ ] **SIST-05**: Ao criar um sistema, o colaborador escolhe o tipo (Fita Padrão / Modular / Magnético 48V / Magnético 24V); o default "Fita Padrão" mantém o fluxo atual idêntico (branch point — sem isso não há flow de montagem).
- [ ] **SIST-01**: Colaborador monta um sistema **MAGNETO 48V** (trilho MAGNETO 22 + N módulos com SKU+qtd) e o sistema deriva a carga total automaticamente, sem contagem manual.
- [ ] **SIST-02**: Colaborador monta um sistema **TINY MAGNETO 24V** (trilho + N módulos), com a carga total derivada.
- [ ] **SIST-03**: Colaborador monta um sistema **modular SYSTEM MOLD** (perfil modular + módulos difusos), com a demanda de fita derivada automaticamente de `Σ(comprimento × qtd)` dos módulos.

### DRV — Dimensionamento de driver (assistido + auditável)

- [ ] **DRV-01**: O sistema dimensiona o driver automaticamente a partir da carga total (48V: bucket LM2343 100W / LM2344 200W com margem ×1.05; 24V: menor driver compatível) e o colaborador **pode revisar e sobrescrever** a escolha — nunca silencioso nem irreversível.
- [ ] **DRV-02**: Um painel de recomendação exibe o SKU + quantidade de driver calculados e oferece botão **"aplicar"** que preenche os campos do driver do sistema (promove `analisarMagneto48V` de aviso → ação).

### COMP — Componentes obrigatórios & voltagem

- [ ] **COMP-01**: O sistema exibe um checklist dos componentes obrigatórios por família (MAGNETO 48V → conector LM2338; TINY → conector LM3168/LM3169; versão embutir → kit LM2987), marcando cada um presente/ausente conforme os SKUs no ambiente.
- [ ] **COMP-02**: Quando um componente obrigatório está ausente, o checklist oferece um atalho **"adicionar componente"** que insere o SKU correto em um clique (pré-preenchendo descrição/preço).
- [ ] **COMP-03**: Um trilho magnético 48V no sistema **trava o seletor de driver em 48V** e bloqueia a seleção de driver de voltagem incompatível (hard lock — voltagem declarada no tipo).

### VAL — Validação no fluxo

- [ ] **VAL-01**: Ao avançar do Step 2 para o Step 3, o sistema **avisa (não-bloqueante)** quando um sistema composto está incompleto (trilho sem driver, ou sem o conector obrigatório da família), com opção de continuar mesmo assim.

### CAT — Catálogo & busca

- [x] **CAT-03**: Conectores e kits de fixação aparecem na busca de componentes do sistema — garantir/corrigir o `tipo_produto` (`conector`, `kit_fixacao`) no catálogo + o filtro de `useProdutoSearch` (data + query).

### DUP — Reuso entre ambientes

- [ ] **DUP-01**: Colaborador duplica um sistema composto inteiro (trilho + módulos + driver + conectores) em outro ambiente, com novos UUIDs em toda a árvore, economizando remontagem.

### PDF — Apresentação ao cliente

- [ ] **PDF-03**: O PDF (**v3**, camada nova via router) renderiza sistemas compostos como bloco estruturado — trilho (SKU+qtd), tabela de módulos, quantidade de driver, acessórios obrigatórios — sem alterar nem arriscar o PDF v2; snapshots/PDFs antigos continuam renderizando.

---

## Out of Scope (v1.3)

| Item | Motivo |
|------|--------|
| BOM genérico (grid editável de todos os componentes) | Scope creep; valor do AURA é montagem guiada, não BOM tool — a tabela do Step 3 já dá visão flat (anti-feature, pesquisa) |
| Auto-split de circuitos 48V (>200W) | Topologia depende de layout físico não modelado; auto-split produz resultado errado — mostrar aviso "múltiplos drivers" e deixar o usuário adicionar 2º trilho/driver (anti-feature) |
| Dimming / CCT por módulo | Overfit; orçamento é documento de preço, não light design — temp/IRC já vão na descrição rica (anti-feature) |
| Trilho 48V com módulos de terceiros | Dados de wattagem/compatibilidade/preço indisponíveis — só SKUs de catálogo (anti-feature) |
| Multi-voltagem no mesmo sistema/trilho | Eletricamente impossível; voltagem é travada no tipo (anti-feature, hard block) |
| PDF vetorial (substituir html2canvas) | Backlog 999.1 — marco próprio |
| Preços via CSV / margem / motor de cálculo v1 refactor | Marco 3 — `.planning/notes/motor-calculo-led-spec.md` |
| WR-01 (passadas famílias sem regra) e demais débitos não-compostos do v1.2 | Tech debt fora do domínio de compostos — fica no audit do v1.2 |

---

## Future Requirements (deferidos)

- Preços via CSV (IMP-02, carryover v1.0) + tabela de custos
- Margem no pedido (Marco 3)
- Documentação + testes das fórmulas de cálculo (Marco 3)
- Follow-ups técnicos v1.1 (SPF/DKIM, dedup toList aniversário, WR-02 monitoring, bucket singular cleanup) + WR-01 do v1.2

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAT-03 | Phase 19 | Complete |
| SIST-05 | Phase 20 | Pending |
| SIST-01 | Phase 20 | Pending |
| SIST-02 | Phase 20 | Pending |
| COMP-01 | Phase 20 | Pending |
| COMP-02 | Phase 20 | Pending |
| COMP-03 | Phase 20 | Pending |
| DRV-01 | Phase 20 | Pending |
| DRV-02 | Phase 20 | Pending |
| SIST-03 | Phase 21 | Pending |
| VAL-01 | Phase 21 | Pending |
| DUP-01 | Phase 21 | Pending |
| PDF-03 | Phase 22 | Pending |
