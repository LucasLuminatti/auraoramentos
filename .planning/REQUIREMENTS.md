# Requirements — Milestone v1.2

**Milestone:** v1.2 — Correções UAT + UX do Wizard de Sistemas de Iluminação
**Opened:** 2026-06-10
**Status:** Roadmap ready — 18/18 requirements mapped

> Capturados a partir do UAT dos funcionários da Aura ("COMENTÁRIOS - SITE ORÇAMENTO", 19 comentários com prints, 2026-06-10). **Escopo decidido:** v1.2 = correções incrementais + melhorias de UX de raiz dentro do fluxo atual (baixo risco, ciclo curto). Os fluxos de **sistemas compostos (MAGNETO/TINY/MODULAR)** são evolução estrutural e foram movidos para o **marco v1.3** (registrado abaixo). Diretriz do Lenny: não só corrigir os 19 comentários, mas deixar o sistema mais intuitivo, didático e difícil de usar errado — propostas de UX de raiz incluídas (UX-01..05), mantidas incrementais (sinalizar no roadmap se alguma exigir mudança estrutural). Pesquisa de suporte em `.planning/research/SUMMARY.md`. **18 requirements em 6 categorias.**

---

## Active Requirements (v1.2)

### CAT — Catálogo & Busca (dados)

- [ ] **CAT-01**: Colaborador encontra na busca de perfil/driver TODOS os produtos da família (ex.: PERFIL CANTONEIRA, WALL WASHER, LM3475, LM3291), corrigindo `tipo_produto` errado/nulo via migração SQL aditiva (WALL WASHER → `'perfil'`, pois `'wall_washer'` não é valor válido no CHECK).
- [ ] **CAT-02**: O aviso/dica exibido ao adicionar o MAGNETO corresponde ao MAGNETO (não ao TINY MAGNETO) — corrigir o mapeamento/dado.

### SIST — Sistemas (advisory que cabe em v1.2)

- [ ] **SIST-04**: Ao adicionar um item da linha Tiny (ex.: TINY SPOT 24V), o sistema avisa que requer driver 24V e oferece a opção de incluí-lo. _(advisory simples; a montagem completa de sistemas compostos é v1.3 — SIST-01/02/03.)_

### TENS — Tensão / Voltagem (redução de erro)

- [ ] **TENS-01**: A voltagem do driver é inferida/validada a partir da fita; quando a voltagem não bate, o sistema avisa (em vez de seleção manual silenciosa).
- [ ] **TENS-02**: Colaborador usa tensão diferente em ambientes diferentes sem bloqueio indevido (remover o link à tensão do ambiente anterior), com a agregação global de drivers agrupando por (código + voltagem).

### CALC — Cálculo / Contabilização

- [ ] **CALC-01**: Fita sem perfil contabiliza a metragem informada (exigir/preencher a metragem manual; não deixar passar como 0m → R$ 0,00 silencioso).
- [ ] **CALC-02**: A metragem/comprimento do perfil reflete automaticamente na descrição após inserir o código.
- [ ] **CALC-03**: A sugestão de passadas de fita é editável (permite reduzir) e respeita a regra de que perfil de 50mm aceita até 3 passadas (sincronizar `passadas_padrao`).

### RES — Apresentação / UX do resumo

- [x] **RES-01**: O Resumo Global de Fitas/Drivers mostra o LOCAL de cada item (ex.: SANCA, MARCENARIA).
- [ ] **RES-02**: A fita não aparece de forma duplicada/confusa (no ambiente e no resumo final) — apresentação coerente para o cliente.
- [ ] **RES-03**: Os drivers aparecem no respectivo ambiente (não apenas em bloco global).
- [ ] **RES-04**: Colaborador duplica/reusa um sistema já montado em outro ambiente (agilidade quando o LOCAL se repete).
- [ ] **RES-05**: Ao avançar para revisão/pagamento, o sistema avisa quando uma peça ficou sem a lâmpada/item esperado.

### UX — Melhorias de raiz (propostas, não citadas literalmente; incrementais)

- [ ] **UX-01**: Quando o colaborador busca na Luminária um código que é perfil/fita/driver (ou vice-versa), o sistema reconhece e direciona ("LM1370 é um perfil — adicione em Sistemas de Iluminação") em vez de "Nenhum produto encontrado". _(ataca a raiz do LM1370/perfis somem)_
- [ ] **UX-02**: Ao escolher a fita, o sistema sugere automaticamente um driver compatível (voltagem + potência) como default. _(estende TENS-01 de "avisar" para "já preencher certo")_
- [ ] **UX-03**: Microcopy/rótulos inline explicando o que entra em "Luminárias" vs "Sistemas de Iluminação" e o que é fita/perfil/driver. _(reduz treinamento)_
- [ ] **UX-04**: Colaborador duplica um ambiente inteiro em um clique (além de duplicar um sistema). _(reduz retrabalho em quartos/sancas iguais)_
- [ ] **UX-05**: A revisão destaca visualmente itens incompletos/suspeitos (fita 0m, sistema sem driver, voltagem divergente, peça sem lâmpada) num checklist antes de gerar o PDF. _(generaliza RES-05; camada de segurança)_

---

## Cobertura dos 19 comentários (v1.2)

| # | Comentário (resumo) | REQ |
|---|---------------------|-----|
| 1a | Perfil: metragem não vai automática na descrição | CALC-02 |
| 1b | Driver: voltagem é manual (deveria inferir/avisar) | TENS-01 (+UX-02) |
| 2 | Refazer escolha de fita em cada ambiente (SANCA) | RES-04 (+UX-04) |
| 3 | Busca não traz a família toda (perfil + driver) | CAT-01 (+UX-01) |
| 4 | Avança pro pagamento sem avisar lâmpada faltando | RES-05 (+UX-05) |
| 5 | Resumo global de fitas precisa do LOCAL | RES-01 |
| 6 | Fita em outro ambiente com tensão diferente: não deixa | TENS-02 |
| 7 | Só fita sem perfil: não contabiliza | CALC-01 |
| 8 | Sistema modular não mostra opções de módulos | → v1.3 (SIST-03) |
| 9 | Módulo: não dá pra incluir fita+driver | → v1.3 (SIST-03) |
| 10 | MAGNETO sem módulos + info é do TINY | CAT-02 (dica) + v1.3 (SIST-01 montagem) |
| 11 | TINY MAGNETO sem opções de módulos/componentes | → v1.3 (SIST-02) |
| 12 | Linha Tiny deve avisar driver 24V e oferecer | SIST-04 |
| 13 | WALL WASHER não aparece | CAT-01 |
| 14 | Alguns perfis não aparecem | CAT-01 |
| 15 | Passadas não devem ficar travadas | CALC-03 |
| 16 | Perfil 50mm pode ter até 3 passadas | CALC-03 |
| 17 | Fita aparece no ambiente e no final (confuso) | RES-02 |
| 18 | Drivers devem ficar no ambiente, não global | RES-03 |

Os 19 pontos seguem 100% endereçados: 16 resolvidos na v1.2; os de **montagem** de sistemas compostos (8, 9, 11 e a parte de montagem do 10) vão pra v1.3. A **dica** trocada do MAGNETO (parte do 10) é corrigida já na v1.2 (CAT-02).

---

## Registrado para v1.3 — Sistemas Compostos (MAGNETO / TINY / MODULAR)

Movido da v1.2 por ser **evolução estrutural** (decisão de arquitetura de modelo de dados + novos fluxos de montagem + edge function + provável PDF v3), ~40% do esforço e ~todo o risco do escopo original.

- **SIST-01**: Montar sistema MAGNETO 48V — módulos + dimensionamento de driver (LM2343/LM2344) + componentes obrigatórios (conector LM2338, kit LM2987).
- **SIST-02**: Montar sistema TINY MAGNETO 24V — módulos + driver 24V + conector (LM3168/LM3169).
- **SIST-03**: Montar sistema modular SYSTEM MOLD (perfil modular + módulos difusos + fita + driver).
- **Decisão de arquitetura pendente**: compostos em `sistemas[]` (discriminated union) vs `luminarias[].composicao?` (recomendação da pesquisa: o 2º, mais conservador). Resolver no início da v1.3.
- **PDF v3** com seção rica de sistemas compostos.

---

## Out of Scope (v1.2)

| Item | Motivo |
|------|--------|
| Montagem de sistemas compostos (MAGNETO/TINY/MODULAR) | Movido para v1.3 (evolução estrutural) |
| Motor de cálculo v1 / `MARGEM_SEGURANCA_DRIVER` / agrupamento de drivers | Marco 3 — spec em `.planning/notes/motor-calculo-led-spec.md` |
| PDF v3 (seção rica de compostos) | v1.3; v1.2 mantém PDF v2 compatível |
| Auto-divisão de circuitos / mistura de voltagens no trilho / módulos de terceiros | Anti-features (pesquisa) |
| Migração para PDF vetorial | Backlog 999.1 |

---

## Future Requirements (deferidos)

- Preços via CSV (IMP-02, carryover v1.0) + tabela de custos
- Margem no pedido (Marco 3)
- Documentação + testes das fórmulas de cálculo (Marco 3)
- Follow-ups técnicos v1.1 (SPF/DKIM, dedup toList aniversário, WR-02 monitoring, bucket singular cleanup)

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAT-01 | Phase 14 | Pending |
| CAT-02 | Phase 14 | Pending |
| TENS-01 | Phase 15 | Pending |
| TENS-02 | Phase 15 | Pending |
| SIST-04 | Phase 15 | Pending |
| UX-02 | Phase 15 | Pending |
| CALC-01 | Phase 16 | Pending |
| CALC-02 | Phase 16 | Pending |
| CALC-03 | Phase 16 | Pending |
| RES-01 | Phase 17 | Complete |
| RES-02 | Phase 17 | Pending |
| RES-03 | Phase 17 | Pending |
| RES-04 | Phase 17 | Pending |
| RES-05 | Phase 17 | Pending |
| UX-01 | Phase 18 | Pending |
| UX-03 | Phase 18 | Pending |
| UX-04 | Phase 18 | Pending |
| UX-05 | Phase 18 | Pending |
