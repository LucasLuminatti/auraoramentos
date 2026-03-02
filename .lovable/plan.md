
# Melhorias na Revisao e Inputs Numericos

## 1. Remover botao de e-mail e destacar botao de PDF (Step3Revisao.tsx)

- Remover o botao "Enviar por E-mail" da secao de acoes (linhas 469-471)
- Remover a importacao do icone `Mail` (linha 7)
- Remover a funcao `handleEmail` (linha 228)
- Transformar o botao "Gerar PDF" de `variant="outline"` para o estilo primario (sem variant ou com classe de destaque), tornando-o o botao principal da pagina

## 2. Corrigir inputs numericos para aceitar digitacao direta

O problema atual: quando o usuario apaga o conteudo de um campo numerico para digitar um novo valor, o `|| 0` ou `|| 1` no onChange forca o valor de volta para 0/1 imediatamente, impedindo que o campo fique vazio temporariamente.

### Solucao

Em todos os inputs numericos do AmbienteCard e do PrecoInput, mudar a logica para:
- Usar `value={valor}` sem o fallback `|| ""` que impede o zero de aparecer
- No onChange, permitir string vazia temporariamente usando estado local ou removendo o fallback `|| 0`
- Aplicar o valor default (0 ou 1) apenas no `onBlur`, quando o usuario sai do campo

**Arquivos afetados:**
- `src/components/AmbienteCard.tsx`: Todos os inputs de quantidade, metragem, passadas, W/M, rolo
- `src/components/Step3Revisao.tsx`: O `numInput` da edicao inline (linha 254-262)

### Detalhes tecnicos

Para cada Input numerico, a mudanca sera:
```typescript
// ANTES
value={item.quantidade}
onChange={(e) => update(i, { ...item, quantidade: parseInt(e.target.value) || 1 })}

// DEPOIS  
value={item.quantidade}
onChange={(e) => {
  const raw = e.target.value;
  update(i, { ...item, quantidade: raw === "" ? 0 : (parseInt(raw) || 0) });
}}
```

Para o `PrecoInput`, ajustar para que `value={value}` (sem `|| ""`) e no onChange usar `parseFloat(e.target.value)` com fallback para 0 apenas se o campo ficar vazio no blur.

No `Step3Revisao.numInput` (linha 259):
```typescript
// ANTES
onChange={(e) => setEditValues((v) => ({ ...v, [field]: parseFloat(e.target.value) || 0 }))}

// DEPOIS
onChange={(e) => {
  const raw = e.target.value;
  setEditValues((v) => ({ ...v, [field]: raw === "" ? 0 : (parseFloat(raw) || 0) }));
}}
```

### Resumo das alteracoes

1. **Step3Revisao.tsx**: Remover botao de e-mail, funcao handleEmail, importacao Mail. Destacar botao PDF como primario.
2. **AmbienteCard.tsx**: Ajustar onChange de todos os inputs numericos para permitir digitacao direta.
3. **Step3Revisao.tsx**: Ajustar numInput para permitir digitacao direta.
