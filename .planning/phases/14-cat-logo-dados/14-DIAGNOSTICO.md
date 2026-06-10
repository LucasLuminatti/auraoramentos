# 14-DIAGNÓSTICO — Catálogo & Dados (CAT-01 / CAT-02)

**Fase:** 14 · **Plano:** 01 · **Gerado:** 2026-06-10 · **Base:** produção `jkewlaezvrbuicmncqbj` (aura-orcamentos)
**Modo:** read-only (nenhuma linha de `product_variants` alterada neste plano)
**Como:** Queries A–D do 14-RESEARCH.md rodadas via service role + agregação em JS (`scripts/diag-14.mjs`, `scripts/diag-14-classify.mjs`).

---

## Query A — Baseline de contagem por tipo_produto (D-04)

| tipo_produto | total |
|---|---|
| (null) | 4053 |
| acessorio | 19 |
| conector | 18 |
| driver | 61 |
| fita | 298 |
| lampada | 100 |
| perfil | 222 |
| spot | 204 |
| **TOTAL** | **4975** |

> Salvar pra calcular o delta pós-migration (Plano 02).

---

## Query B — Varredura ampla de null/inválidos (D-01)

4.053 produtos têm `tipo_produto = NULL`. **Mas a grande maioria são luminárias/acessórios que JÁ aparecem no seletor correto** — o filtro `luminaria` em `useProdutoSearch.ts:28` casa `tipo_produto IS NULL`, então um produto null já é encontrável na busca de luminária. O bug do UAT é específico: produtos que deveriam estar nos seletores **perfil / driver / fita** (filtro `.eq('tipo_produto', filtro)`) e estão null → somem desses seletores.

Grupos null por categoria (Query B):

| qtd | categoria | exemplo |
|---|---|---|
| 3724 | (sem categoria) | luminárias gerais — **não mexer** (aparecem no seletor luminária) |
| 193 | Perfis | perfis + conectores/difusores de perfil |
| 65 | Luminarias | downlights — ficam null (seletor luminária) |
| 23 | Fitas e Drivers | fitas + conectores de fita |
| 23 | Lampadas | AR111 etc — ficam null (seletor luminária) |
| 16 | AU Coringa | amplificadores/controladores |
| 9 | Area Externa | espetos de jardim |

**Recategorização por descrição (rule-based, D-02):** classifiquei os 4.053 nulls por descrição para isolar só os que estão escondidos do seletor errado:

| Grupo | Regra (descrição) | Qtd | tipo_produto ALVO | Tier |
|---|---|---|---|---|
| **Perfis** | começa com `PERFIL ` (extrusão real; exclui DIFUSOR/KIT/CONECTOR/TAMPA/ACABAMENTO) | **401** | `perfil` | **1 — funcional** |
| **Fitas** | começa com `FITA ` / `MANGUEIRA` (rolo de fita real) | **18** | `fita` | **1 — funcional** |
| Drivers | começa com `DRIVER`/`FONTE` | **0** | — (todos os 61 já categorizados) | — |
| Acessórios de perfil | DIFUSOR / KIT / CONECTOR / ACABAMENTO / TAMPA p/ perfil | ~1143 | `acessorio` (opcional) | 2 — cosmético |
| Spot embutir Wall Washer | `SPOT EMBUTIR ... WALL WASHER` (LM1000–LM1005) | 6 | `spot` (opcional) | 2 — cosmético |

> **Tier 1** = produtos hoje invisíveis no seletor onde o colaborador os procura → **corrige o bug do UAT**.
> **Tier 2** = produtos null que já aparecem no seletor luminária; mudar é só higiene semântica, **sem efeito funcional**. Recomendo **deferir** (evita reclassificar ~1.150 SKUs com risco de erro, sem ganho de UX nesta milestone).

---

## Query C — Famílias do UAT confirmadas

As 4 famílias reportadas estão com `tipo_produto = NULL` (não `'wall_washer'` — o CHECK rejeita esse valor, conforme Pitfall 2 do RESEARCH):

| codigo | descrição | tipo_atual | ALVO |
|---|---|---|---|
| LM3475 / LM3477 / LM3479 (+ pretos LM3476/78/80) | PERFIL WALL WASHER | null | `perfil` |
| LM3291 (+ AC) | PERFIL DE SOBR NANO LARGO 30MM | null | `perfil` |
| LM982 / LM983 / LM1646… | PERFIL DE SOBREPOR CANTONEIRA | null | `perfil` |
| LM1369 / LM3787 / LM3737… | DIFUSOR / KIT / ACABAMENTO p/ CANTONEIRA/WALL WASHER | null | acessório (Tier 2 — já no seletor luminária) |

> **Nuance sinalizada:** nem todo "WALL WASHER" é perfil. `SPOT EMBUTIR ... WALL WASHER` (LM1000–1005) são spots; difusores/kits são acessórios. Por isso o ALVO é por **descrição "começa com PERFIL"**, não por "contém WALL WASHER" — D-02b ("WALL WASHER → perfil") aplicado só às extrusões reais.

---

## Query D — Causa-raiz MAGNETO (CAT-02 / D-03)

**Resultado: o dado já está CORRETO.** Todos os 27 produtos `MAGNETO22` têm `sistema = 'magneto_48v'` e todos os `TINY MAG` têm `sistema = 'tiny_magneto'`. Nenhum produto MAGNETO 48V está com `sistema` nulo ou trocado.

| família | sistema (DB) | nº SKUs | exemplos |
|---|---|---|---|
| MAGNETO22 (48V) | `magneto_48v` ✓ | 27 | LM2322–LM2344, trilhos/módulos/spots/conectores/drivers |
| TINY MAG (24V) | `tiny_magneto` ✓ | ~50 | LM3119–LM3175 |

**Aplicando a tabela de decisão do RESEARCH:** com `sistema = 'magneto_48v'`, a 1ª condição da `AmbienteCard.tsx:81` (`produto.sistema_magnetico === 'magneto_48v'`) é verdadeira → **dispara o toast MAGNETO correto**, antes do branch TINY (L89). Logo:

- **Decisão CAT-02 = NENHUM fix de dado necessário** (o dado já está certo; o bug do UAT provavelmente foi observado antes de uma correção de dado anterior, ou com `sistema` nulo num produto específico — não há mais nenhum hoje).
- **Opcional (hardening, alinhado à diretiva "difícil de configurar errado"):** o regex fallback `/MAGNETO22/` na L81 é frágil — um futuro produto descrito "MAGNETO 48V" sem o literal "MAGNETO22" e com `sistema` nulo não dispararia o aviso. Trocar por `(/MAGNETO/.test(d) && !/TINY/.test(d))` blinda contra isso. **Não corrige bug atual; é prevenção.**

---

## Decisão APROVADA (checkpoint D-02) — Lenny, 2026-06-10

- [x] **CAT-01 escopo:** **Tier 1** — 401 perfis → `perfil`, 18 fitas → `fita`. Tier 2 deferido (limpeza semântica em etapa futura).
- [x] **CAT-02:** **NENHUM fix** — dado já correto; `AmbienteCard.tsx` permanece inalterado. (Hardening opcional do regex NÃO aplicado.)

Lista explícita gravada na seção "## SKUs aprovados (para migration)" abaixo.

**Relatório exigido pelo Lenny no Plano 02:** nº de perfis corrigidos, nº de fitas corrigidas, exemplos dos grupos (WALL WASHER, CANTONEIRA, NANO), contagem antes/depois por tipo_produto.

---


## SKUs aprovados (para migration)

**Grupo PERFIL (401 SKUs) → `tipo_produto = 'perfil'`** — lista explícita no Apêndice (Lista PERFIL). Inclui: WALL WASHER (LM3475–LM3480), CANTONEIRA (LM982/983/1646…), NANO (LM3291/LM3292…), PERFIL DE SOBREPOR/EMBUTIR.

**Grupo FITA (18 SKUs) → `tipo_produto = 'fita'`** — lista explícita no Apêndice (Lista FITA): AU004, LM3634, LM3635, LM3636, LM3637, LM3638, LM3665, LM3666, LM3667, LM3668, LM3669, LM3670, LM3823, LM3824, LM3825, LM3826, LM3827, LM3828.

**MAGNETO (CAT-02):** nenhum UPDATE — dado já `magneto_48v`/`tiny_magneto` correto.

> A migration do Plano 02 usa `WHERE codigo IN (...)` com estas listas + guarda `tipo_produto IS DISTINCT FROM '<alvo>'`.

---

## Apêndice — Listas explícitas (Tier 1, para a migration do Plano 02)

### Lista PERFIL (401 SKUs → tipo_produto = perfil)

```
LM1481, LM1481AC, LM1482, LM1482AC, LM1483, LM1483AC, LM1484, LM1484AC, LM1485, LM1485AC,
LM1486, LM1486AC, LM1487, LM1487AC, LM1488, LM1488AC, LM1489, LM1489AC, LM1490AC, LM1491AC,
LM1492AC, LM1493AC, LM1494AC, LM1495AC, LM1496AC, LM1497AC, LM1498AC, LM1538, LM1538AC,
LM1539, LM1539AC, LM1540, LM1540AC, LM1541, LM1541AC, LM1542, LM1542AC, LM1543, LM1543AC,
LM1544, LM1544AC, LM1545, LM1545AC, LM1546, LM1546AC, LM1547AC, LM1548AC, LM1549AC, LM1550AC,
LM1551AC, LM1552AC, LM1553AC, LM1554AC, LM1555AC, LM1592, LM1592AC, LM1593, LM1593AC, LM1594,
LM1594AC, LM1595, LM1595AC, LM1596, LM1596AC, LM1597, LM1597AC, LM1598, LM1598AC, LM1599,
LM1599AC, LM1600, LM1600AC, LM1601AC, LM1602AC, LM1603AC, LM1604AC, LM1605AC, LM1606AC,
LM1607AC, LM1608AC, LM1609AC, LM1646, LM1646AC, LM1647, LM1647AC, LM1648, LM1648AC, LM1649,
LM1649AC, LM1650, LM1650AC, LM1651, LM1651AC, LM1652, LM1652AC, LM1653, LM1653AC, LM1654,
LM1654AC, LM1655, LM1655AC, LM1656, LM1656AC, LM1657, LM1657AC, LM1658, LM1658AC, LM1659,
LM1659AC, LM1660, LM1660AC, LM1661, LM1661AC, LM1662, LM1662AC, LM1663, LM1663AC, LM1664AC,
LM1665AC, LM1666AC, LM1667AC, LM1668AC, LM1669AC, LM1670AC, LM1671AC, LM1672AC, LM1709,
LM1709AC, LM1710, LM1710AC, LM1711, LM1711AC, LM1712, LM1712AC, LM1713, LM1713AC, LM1714,
LM1714AC, LM1715, LM1715AC, LM1716, LM1716AC, LM1717, LM1717AC, LM1718AC, LM1719AC, LM1720AC,
LM1721AC, LM1722AC, LM1723AC, LM1724AC, LM1725AC, LM1726AC, LM1764, LM1764AC, LM1765,
LM1765AC, LM1766, LM1766AC, LM1767, LM1767AC, LM1768, LM1768AC, LM1769, LM1769AC, LM1770,
LM1770AC, LM1771, LM1771AC, LM1772, LM1772AC, LM1773AC, LM1774AC, LM1775AC, LM1776AC,
LM1777AC, LM1778AC, LM1779AC, LM1780AC, LM1781AC, LM1855, LM1855AC, LM1856, LM1856AC, LM1857,
LM1857AC, LM1858, LM1858AC, LM1859, LM1859AC, LM1860, LM1860AC, LM1861, LM1861AC, LM1862,
LM1862AC, LM1863, LM1863AC, LM1873, LM1874, LM1875, LM1876, LM1877, LM1878, LM1879, LM1880,
LM1881, LM1885, LM1886, LM1887, LM1888, LM1889, LM1890, LM1891, LM1892, LM1893, LM1981,
LM1982, LM1983, LM1984, LM1985, LM1986, LM1987, LM1987AC, LM1988, LM1988AC, LM1989, LM1989AC,
LM1990, LM1991, LM1991AC, LM1993, LM1993AC, LM1994, LM1994AC, LM1995, LM1995AC, LM2378,
LM2379, LM2388, LM2394, LM2395, LM2400, LM2401, LM2402, LM2403, LM2404, LM2405, LM2406,
LM2407, LM2408, LM2409, LM2411, LM2413, LM2414, LM2415, LM2416, LM2417, LM2418, LM2419,
LM2420, LM2421, LM2422, LM2423, LM2424, LM2425, LM2426, LM2427, LM2428, LM2429, LM2430,
LM2431, LM2432, LM2433, LM2434, LM2830, LM2831, LM2832, LM2833, LM2834, LM2835, LM2855,
LM2925, LM2926, LM2927, LM2928, LM2929, LM2930, LM2951, LM2952, LM2953, LM2954, LM2955,
LM2956, LM2965, LM2966, LM2967, LM2968, LM2969, LM2970, LM3057, LM3058, LM3059, LM3060,
LM3061, LM3062, LM3063, LM3064, LM3065, LM3066, LM3067, LM3068, LM3069, LM3070, LM3071,
LM3072, LM3073, LM3074, LM3211, LM3219, LM3222, LM3291, LM3291AC, LM3292, LM3292AC, LM3293,
LM3293AC, LM3294, LM3294AC, LM3295, LM3295AC, LM3296, LM3296AC, LM3303, LM3304, LM3392,
LM3393, LM3398, LM3399, LM3400, LM3404, LM3410, LM3411, LM3442, LM3442AC, LM3443, LM3443AC,
LM3444, LM3444AC, LM3445, LM3445AC, LM3446, LM3446AC, LM3447, LM3447AC, LM3475, LM3476,
LM3477, LM3478, LM3479, LM3480, LM3583, LM3584, LM3585, LM3586, LM3587, LM3588, LM974,
LM974AC, LM975, LM975AC, LM978, LM978AC, LM979, LM979AC, LM982, LM982AC, LM983, LM983AC,
LM984, LM984AC, LM985, LM985AC, LM988, LM988AC, LM989, LM989AC, LM992, LM993, OR2096, OR2097,
OR2098, OR2099, OR2100, OR2101, OR2170, OR2171, OR2172, OR2173, OR2174, OR2175
```

### Lista FITA (18 SKUs → tipo_produto = fita)

```
AU004, LM3634, LM3635, LM3636, LM3637, LM3638, LM3665, LM3666, LM3667, LM3668, LM3669,
LM3670, LM3823, LM3824, LM3825, LM3826, LM3827, LM3828
```
