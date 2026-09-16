/**
 * Regra de senha do AURA — a MESMA que o Supabase Auth aplica no servidor
 * (Authentication → Sign In / Providers → Email: mínimo 8 caracteres, com minúscula, maiúscula
 * e número; configurado em 2026-09-16). Se a tela aceitar menos que o servidor, o vendedor
 * recebe o erro cru do Supabase, em inglês. Mudou lá → mudar aqui.
 *
 * O caractere especial não é exigido: conta para a força exibida e fica como recomendação.
 */

export const SENHA_MIN_CARACTERES = 8;

export type CriterioSenha = "minLength" | "hasUpper" | "hasLower" | "hasNumber" | "hasSpecial";

export function getPasswordStrength(password: string) {
  const checks: Record<CriterioSenha, boolean> = {
    minLength: password.length >= SENHA_MIN_CARACTERES,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const label =
    score <= 1 ? "Muito fraca" : score === 2 ? "Fraca" : score === 3 ? "Média" : score === 4 ? "Forte" : "Muito forte";
  const color =
    score <= 1 ? "bg-destructive" : score === 2 ? "bg-orange-500" : score === 3 ? "bg-yellow-500" : score === 4 ? "bg-emerald-400" : "bg-emerald-600";
  return { checks, score, label, color, percent: (score / 5) * 100 };
}

export const REGRAS_SENHA: { key: CriterioSenha; text: string; obrigatoria: boolean }[] = [
  { key: "minLength", text: `Mínimo ${SENHA_MIN_CARACTERES} caracteres`, obrigatoria: true },
  { key: "hasUpper", text: "Uma letra maiúscula", obrigatoria: true },
  { key: "hasLower", text: "Uma letra minúscula", obrigatoria: true },
  { key: "hasNumber", text: "Um número", obrigatoria: true },
  { key: "hasSpecial", text: "Um caractere especial (!@#$...) — recomendado", obrigatoria: false },
];

/** A senha passa no servidor? (todas as regras obrigatórias) */
export function senhaAtendeRequisitos(password: string): boolean {
  const { checks } = getPasswordStrength(password);
  return REGRAS_SENHA.every((r) => !r.obrigatoria || checks[r.key]);
}

export const MENSAGEM_REQUISITOS_SENHA =
  `A senha precisa ter pelo menos ${SENHA_MIN_CARACTERES} caracteres, com letra maiúscula, letra minúscula e número.`;
