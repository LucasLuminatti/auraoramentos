import { describe, it, expect } from "vitest";
import { filtrarPorTexto } from "@/pages/Admin";

// RULE-089 — busca por nome nas sub-abas Arquitetos e Clientes do Admin.
describe("filtrarPorTexto (RULE-089)", () => {
  const arquitetos = [
    { id: "1", nome: "Léo Schettmann", contato: "leo@escritorio.com" },
    { id: "2", nome: "Aline Souza", contato: null },
    { id: "3", nome: "Marcos Lima", contato: "11 99999-0000" },
  ];

  it("retorna a lista inteira quando o termo está vazio", () => {
    expect(filtrarPorTexto(arquitetos, "", ["nome"])).toHaveLength(3);
    expect(filtrarPorTexto(arquitetos, "   ", ["nome"])).toHaveLength(3);
  });

  it("filtra por substring do nome, ignorando maiúsculas/minúsculas", () => {
    const r = filtrarPorTexto(arquitetos, "aLiNe", ["nome"]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("2");
  });

  it("considera todos os campos informados", () => {
    const r = filtrarPorTexto(arquitetos, "escritorio.com", ["nome", "contato"]);
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe("1");
  });

  it("tolera campos null/undefined sem quebrar", () => {
    expect(() => filtrarPorTexto(arquitetos, "zzz", ["nome", "contato"])).not.toThrow();
    expect(filtrarPorTexto(arquitetos, "zzz", ["nome", "contato"])).toHaveLength(0);
  });

  it("filtra clientes por nome, email ou telefone", () => {
    const clientes = [
      { id: "a", nome: "Casa do João", email: "joao@x.com", telefone: "11 91234-5678" },
      { id: "b", nome: "Apto Maria", email: null, telefone: null },
    ];
    expect(filtrarPorTexto(clientes, "91234", ["nome", "email", "telefone"])[0].id).toBe("a");
    expect(filtrarPorTexto(clientes, "maria", ["nome", "email", "telefone"])[0].id).toBe("b");
  });
});
