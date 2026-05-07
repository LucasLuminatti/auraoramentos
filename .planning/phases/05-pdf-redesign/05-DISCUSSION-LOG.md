---
phase: 05
slug: pdf-redesign
created: 2026-05-07
type: discussion-log
---

# Phase 5 — PDF Redesign — Discussion Log

Registro das perguntas feitas e respostas dadas pelo Lenny durante
`/gsd-discuss-phase 5`.

## Áreas selecionadas

Após apresentação de 4 áreas cinzas (A, B, C, D), Lenny selecionou:
- **A — Direção visual + tipografia**
- **B — Estrutura de tabelas e itens**

Áreas C (bloco de texto final) e D (TOTAL GERAL e refs finais) ficaram para
o planning resolver com defaults.

---

## Área A — Direção visual + tipografia

**P1: Qual referência visual o PDF redesenhado deve seguir?**
Resposta: **Editorial / Apple-like**
> Hierarquia tipográfica forte, contraste de tamanho, generoso em respiro,
> usa peso de fonte como hierarquia.

**P2: O que fazer com a paleta de cor da Luminatti (laranja #E68601)?**
Resposta: **Manter laranja como acento**
> Preto/branco/cinza dominante + laranja Luminatti em detalhes (linha de
> header, total, badges). Identidade preservada.

**P3: Que família tipográfica usar?**
Resposta: **Playfair + Inter (serif + sans)**
> Serif elegante nos títulos (Playfair) + Inter no corpo. Vibe
> editorial/premium, contraste forte.

**P4: Quantos níveis de hierarquia visual o PDF deve ter?**
Resposta inicial: **4 níveis (média)** — Título → seção → subseção → item.
Resposta refinada via P4 da Área B: **5 níveis efetivos**
(Doc → Ambiente → Local → Sistema → Componentes).

---

## Área B — Estrutura de tabelas e itens

**P1: Como apresentar os itens dentro de cada ambiente?**
Resposta: **Híbrido (tabela + chips)**
> Tabela enxuta + chips/badges abaixo de cada linha pra specs (W, V, IP etc).
> Tenta ser denso mas legível.

**P2: Imagens de produto no PDF — o que fazer?**
Resposta: **Thumbnail por item**
> Cada item tem foto 40x40 ou 60x60 à esquerda. Ajuda cliente reconhecer
> mas pesa o PDF. Lenny aceitou esse trade-off.

**P3: Quais colunas/campos são essenciais por item?** (multi-select)
Resposta: **TODAS as 4 opções**
- Quantidade + unidade
- Potência (W) e tensão (V)
- Preço unitário
- Código / SKU do produto

**P4: Como agrupar visualmente os sistemas dentro do ambiente?**
Resposta (custom): estrutura hierárquica aninhada explícita
```
[SALA]
 → Sanca
   ┌ Sistema 1 ┐
     Fita  Driver  Perfil
   ┌ Sistema 2 ┐
     Fita  Driver  Perfil
 → Rasgo
   ┌ Sistema 1 ┐
     Fita  Driver  Perfil
```
> Lenny quer hierarquia visual explícita: Ambiente → Sub-ambiente/local
> (Sanca, Rasgo) → Sistema → Componentes. Isso adiciona um nível abaixo
> de Ambiente que **não existe no schema atual** — vai precisar virar
> campo aditivo opcional ou virar string num campo existente. Decisão
> técnica fica para o planning.

---

## Itens para o planner endereçar

1. **Sub-ambiente / Local** não existe no schema atual. Opções:
   a) Adicionar campo opcional `local` em luminária/sistema (schema aditivo).
   b) Reusar campo existente (ex: nome do sistema) e parsear.
   c) Virar campo apenas de UI (não persiste, derivado do nome do sistema).
   Recomendação preliminar: (a) com campo opcional pra não quebrar orçamentos antigos.

2. **Defaults Área C** (bloco de texto final substituindo as 4 caixas):
   manter conteúdo das 4 caixas como bloco de texto contínuo, formatado em
   parágrafos com headers em Playfair small-caps.

3. **Defaults Área D** (TOTAL GERAL):
   manter card destaque, redesenhado em estilo editorial — número grande
   em Playfair, label pequena em Inter uppercase, faixa laranja sutil
   à esquerda como acento.

4. **Compat PDF-05**: usar `pdf_template_version` no orçamento; default
   para v2 (novo template) em orçamentos novos; v1 (template atual) para
   snapshots anteriores.

5. **Fontes**: pesquisar entre `@fontsource` (bundle) vs CDN. Para PDF
   client-side via html2pdf.js, fontes embeddadas tendem a renderizar
   mais consistente.
