---
plan: 05-05
phase: 05-pdf-redesign
type: execute
status: complete
tasks-completed: 5-of-5
uat: approved-via-playwright
---

## UAT Result (2026-05-07, via Playwright MCP)

Bug crítico encontrado e corrigido durante UAT:
- `ALTER TABLE ADD COLUMN ... DEFAULT 2` preencheu rows existentes com 2 (não NULL como o comentário do SQL afirmava). Quebraria PDF-05 (compat retroativa de snapshots legacy).
- Fix em `20260507180000_backfill_pdf_template_version_legacy.sql`: UPDATE NULL em rows pré-Phase-5 + DROP DEFAULT.

Pós-fix:

| Cenário | DB state | Template gerado | Resultado |
|---------|----------|-----------------|-----------|
| Snapshot antigo (`f39ca4b4`, created 2026-04-27) | `pdf_template_version=NULL` | v1 (Outfit + info-grid + Google Fonts CDN + dark total) | ✅ |
| Mesmo snapshot com `v=2` (PATCH simulando Phase 5+) | `pdf_template_version=2` | v2 (Playfair + amb-name + doc-title + total-card + 5× orange + sem info-grid/CDN/Outfit) | ✅ |
| Re-emit após PATCH | `pdf_template_version=2` | v2 (idem) | ✅ |
| Console errors relacionados à Phase 5 | — | 0 | ✅ |

Lenny validou via passagem de credenciais para teste autônomo via Playwright MCP. Orçamento de teste revertido para `NULL` ao final (não contamina prod).

## What was built

Plan 05-05 finaliza a integração end-to-end do redesign de PDF: novos orçamentos saem com o template v2 editorial e persistem `pdf_template_version: 2`; orçamentos antigos (sem coluna preenchida) continuam saindo com o template v1 legacy via `?? 1` no leitor.

**Arquivos:**

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| `src/lib/pdfTemplates/v1.ts` | NOVO — extração 1:1 do template legacy (preserva Outfit, info-grid, fundo escuro do total) | 409 |
| `src/lib/gerarPdfHtml.ts` | REFATOR — virou router enxuto v1/v2 (de 421 → 45 linhas) | -376 |
| `src/components/Step3Revisao.tsx` | persiste `pdf_template_version: 2` (insert + update); chama `ensureFontsReady` + `inlineImagensSnapshot` antes de gerar; passa `templateVersion: 2`; `pagebreak.mode: ["css","legacy"]` | +21/-3 |
| `src/pages/OrcamentoDetalhe.tsx` | adiciona `pdf_template_version` ao SELECT + tipo `OrcamentoFull`; lê `orc.pdf_template_version ?? 1` (coalesce p/ legacy); helpers + pagebreak idem Step3 | +13/-3 |

## Commits (sequential)

- `e2837bb` — feat(05-05): extract legacy PDF template to v1.ts
- `c411836` — refactor(05-05): turn gerarPdfHtml.ts into v1/v2 router
- `05f8340` — chore(05-05): merge executor worktree (tasks 1-2 — v1 extract + router)
- `8807233` — feat(05-05): wire Step3Revisao to v2 template + persist pdf_template_version
- `df03fa5` — feat(05-05): wire OrcamentoDetalhe to read pdf_template_version on re-emit

## Routing logic (PDF-05 compat)

```
Snapshot antigo (rows pré-Phase 5):
  pdf_template_version=NULL → leitor coage `?? 1` → router recebe 1 → v1 (legacy preservado)

Orçamento novo (Step3Revisao):
  templateVersion: 2 explícito → router recebe 2 → v2 (editorial Apple-like)
  + DB persist pdf_template_version=2 → re-emissão futura também sai v2
```

## Verification (automated)

- `npm run build` → exit 0 (3463 modules, pdfFonts + pdfImages aparecem como chunks separados)
- `grep` checks: 2× `pdf_template_version: 2` em Step3Revisao, 1× `?? 1` em OrcamentoDetalhe, 0× `avoid-all` em ambos call sites

## Deviations

- Plano dividido em execução por subagent + inline. O subagent executou Tasks 1-2 (commits cleanos) e iniciou Task 3 mas stalled antes de commitar (stream watchdog disparou após 600s). O orquestrador retomou inline com as mudanças WIP do worktree para Step3, depois aplicou Task 4 do zero, depois escreveu este SUMMARY.
- Sem perda de trabalho: o WIP do worktree foi inspecionado via `git diff` e replicado fielmente em main.

## ⚠ Carry-over from Plan 05-01 — auth gate

A migration `supabase/migrations/20260507000001_add_pdf_template_version.sql` está commitada mas **NÃO foi aplicada em produção** (sem `SUPABASE_ACCESS_TOKEN` no ambiente do executor). `types.ts` foi patchada deterministicamente por antecipação para o build passar, mas qualquer `INSERT/UPDATE` em prod com `pdf_template_version: 2` vai falhar com "column does not exist" até que Lenny rode:

```powershell
cd auraoramentos
npx supabase login        # se ainda não autenticado
npx supabase link --project-ref jkewlaezvrbuicmncqbj
npx supabase db push
```

**Bloqueia:** Step3Revisao (orçamento novo não persiste) e OrcamentoDetalhe re-emit (campo retorna null em todo row → tudo vira v1, mesmo orçamentos novos).
**NÃO bloqueia:** geração de PDF em si — `templateVersion: 2` é passado ao router via param em memória, então mesmo sem persistência o PDF baixa com layout v2 no Step3.

## Task 5 — UAT visual (checkpoint blocking)

Aguarda validação manual do Lenny seguindo o checklist de `05-05-PLAN.md`:

1. **Snapshot antigo (compat PDF-05):** abrir `/admin/orcamento/:id` de um orçamento criado antes desta phase → "Re-emitir PDF" → confirmar layout LEGACY (Outfit, info-grid, total escuro).
2. **Orçamento novo (v2 editorial):** wizard `/` → criar orçamento dummy com Local "Sanca" + sistema sem Local + thumbnails → Step3 → "Gerar PDF" → confirmar todos os 13 critérios visuais (Playfair 32, header laranja, italic Local, chips, thumbs 48×48, total faixa laranja, bloco prose final, AUSÊNCIA de info-grid e emojis).
3. **Re-emitir orçamento novo:** após (2), ir em `/admin/orcamento/:id` → "Re-emitir PDF" → confirmar mesmo layout v2.
4. **Console limpo:** sem erros JS durante geração.

**Resume signal:** "approved" se OK, ou descrever issues específicas.

## key-files.created

- src/lib/pdfTemplates/v1.ts
- .planning/phases/05-pdf-redesign/05-05-SUMMARY.md
