-- CAT (cauda do UAT #13/#14): perfis puros que ficaram sem tipo_produto='perfil'
-- após a migração CAT-01 (v1.2) e por isso não aparecem no seletor de Perfil do wizard.
--
-- Escopo (decisão Lenny 2026-06-17): SOMENTE os 49 perfis PUROS cuja descrição começa
-- com "PERFIL " e NÃO têm LED integrado. Excluídos de propósito:
--   - "PERFIL ... COM LED INTEGRADO" (108) -> luminárias lineares, não levam fita (fora de escopo)
--   - LM2991 "PERFIL FLEXIVEL ... 10W/M" -> fita LED flexível (permanece 'acessorio')
--   - OR2041/LM2860/OR2042/LM2861 "PERFIL NO FRAME WIDE KIT DE FIXACAO" -> kits de fixação
--
-- Aditivo e idempotente: só toca linhas cujo tipo_produto ainda não é 'perfil'.
-- Não altera snapshots de orçamentos (jsonb autocontido) — só afeta novas buscas.

UPDATE produtos
SET tipo_produto = 'perfil'
WHERE tipo_produto IS DISTINCT FROM 'perfil'
  AND codigo IN (
    'LM3641','LM3643','LM3642','LM3644',
    'LM1997AC','LM1997',
    'LM2758AC','LM2761AC','LM2764AC','LM2759AC','LM2762AC','LM2765AC',
    'LM2758','LM2761','LM2764','LM2759','LM2762','LM2765',
    'LM2496AC','LM2497AC','LM2498AC','LM2499AC','LM2500AC','LM2501AC',
    'LM2496','LM2497','LM2498','LM2499','LM2500','LM2501','LM2502',
    'LM2767AC','LM2769AC','LM2771AC','LM2768AC','LM2770AC','LM2772AC',
    'LM2767','LM2769','LM2771','LM2768','LM2770','LM2772',
    'LM1992','LM1992AC','LM1996AC','LM1996',
    'LM3639','LM3640'
  );
