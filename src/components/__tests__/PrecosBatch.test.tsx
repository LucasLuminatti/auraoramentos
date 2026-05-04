import { describe, it, expect } from "vitest";
import { validarPendingChanges } from "../PrecosBatch";

describe("validarPendingChanges (D-17)", () => {
  it("retorna invalido com errorId quando preco_minimo > preco_tabela", () => {
    const m = new Map([
      ["id-1", { preco_tabela: 100, preco_minimo: 50 }],
      ["id-2", { preco_tabela: 80, preco_minimo: 90 }],
    ]);
    const r = validarPendingChanges(m);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errorId).toBe("id-2");
  });

  it("retorna valido quando todas as entries tem preco_minimo <= preco_tabela", () => {
    const m = new Map([
      ["id-1", { preco_tabela: 100, preco_minimo: 50 }],
      ["id-2", { preco_tabela: 80, preco_minimo: 80 }],
    ]);
    expect(validarPendingChanges(m).valid).toBe(true);
  });

  it("retorna valido para Map vazio", () => {
    expect(validarPendingChanges(new Map()).valid).toBe(true);
  });
});
