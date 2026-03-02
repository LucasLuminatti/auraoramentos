
# Substituir logo da Aura por versao em alta qualidade

## O que sera feito

Copiar a imagem enviada (`logotipo_aura_azul_RGB.jpg`) para `src/assets/logo.png`, substituindo o arquivo atual. Como todos os 7 arquivos que usam o logo importam de `@/assets/logo.png`, a troca sera automatica em todo o app:

- Pagina inicial (Index.tsx)
- Pagina de login (Auth.tsx)
- Pagina de esqueci senha (ForgotPassword.tsx)
- Pagina de redefinir senha (ResetPassword.tsx)
- Pagina de solicitar acesso (RequestAccess.tsx)
- Painel Admin (Admin.tsx)
- Upload de imagens (AdminUploadImagens.tsx)
- PDF gerado (via base64 no Step3Revisao.tsx)

## Detalhes tecnicos

1. Copiar `user-uploads://logotipo_aura_azul_RGB.jpg` para `src/assets/logo.png` (sobrescreve o arquivo existente)
2. Nenhum codigo precisa ser alterado - todos os imports ja apontam para `@/assets/logo.png`

**Observacao:** A imagem tem fundo branco. Nos locais onde o fundo da pagina tambem e branco/claro, isso sera imperceptivel. No PDF, o header tambem tem fundo claro (cream), entao ficara harmonioso.
