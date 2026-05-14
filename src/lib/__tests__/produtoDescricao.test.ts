import { describe, it, expect } from "vitest";
import { construirDescricaoRica } from "@/lib/produtoDescricao";

describe("construirDescricaoRica", () => {
  it("formato completo: nome + temperatura + potência + IRC + nicho", () => {
    const result = construirDescricaoRica({
      nome: "Plafon X",
      atributos: { temperatura_k: 4000, irc: 90, nicho: "embutir" },
      potenciaWatts: 12,
    });
    expect(result).toBe("Plafon X | 4000K | 12W | IRC 90 | embutir");
  });

  it("parcial: só nome + temperatura_k", () => {
    const result = construirDescricaoRica({
      nome: "Plafon X",
      atributos: { temperatura_k: 4000 },
    });
    expect(result).toBe("Plafon X | 4000K");
  });

  it("snapshot antigo: só nome (sem atributos)", () => {
    const result = construirDescricaoRica({ nome: "Plafon X" });
    expect(result).toBe("Plafon X");
  });

  it("atributos explicitamente null: retorna só o nome", () => {
    const result = construirDescricaoRica({ nome: "Plafon X", atributos: null });
    expect(result).toBe("Plafon X");
  });

  it("potencia=0 NÃO é suprimida (0W é valor válido, distinto de ausente)", () => {
    const result = construirDescricaoRica({ nome: "Plafon X", potenciaWatts: 0 });
    expect(result).toBe("Plafon X | 0W");
  });

  it("string vazia em nicho é tratada como ausente", () => {
    const result = construirDescricaoRica({
      nome: "Plafon X",
      atributos: { nicho: "" },
    });
    expect(result).toBe("Plafon X");
  });

  it("potencia null + atributos sem irc: suprime W e IRC", () => {
    const result = construirDescricaoRica({
      nome: "Plafon X",
      atributos: { temperatura_k: 3000, nicho: "sobrepor" },
      potenciaWatts: null,
    });
    expect(result).toBe("Plafon X | 3000K | sobrepor");
  });

  it("atributos com valores stringificados (vindo de JSONB Postgres): coerce para number", () => {
    const result = construirDescricaoRica({
      nome: "Plafon X",
      atributos: { temperatura_k: "4000", irc: "90" },
      potenciaWatts: 12,
    });
    expect(result).toBe("Plafon X | 4000K | 12W | IRC 90");
  });
});
