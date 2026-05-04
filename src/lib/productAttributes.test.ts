import { describe, it, expect } from "vitest";
import { parseTensao, parsePotencia, mapMasterRow } from "./productAttributes";

describe("parseTensao", () => {
  it("returns 12 for '12V DC'", () => {
    expect(parseTensao("12V DC")).toBe(12);
  });
  it("returns 24 for '24V DC'", () => {
    expect(parseTensao("24V DC")).toBe(24);
  });
  it("returns 48 for '48V DC'", () => {
    expect(parseTensao("48V DC")).toBe(48);
  });
  it("returns 24 for '24VDC' (sem espaço)", () => {
    expect(parseTensao("24VDC")).toBe(24);
  });
  it("returns null for '127V/220V' (não é DC)", () => {
    expect(parseTensao("127V/220V")).toBeNull();
  });
  it("returns null for '250V' (não é DC)", () => {
    expect(parseTensao("250V")).toBeNull();
  });
  it("returns null for '127V' (não é DC)", () => {
    expect(parseTensao("127V")).toBeNull();
  });
  it("returns null for '36V DC' (DC mas fora de 12/24/48)", () => {
    expect(parseTensao("36V DC")).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(parseTensao("")).toBeNull();
  });
  it("returns null for null", () => {
    expect(parseTensao(null)).toBeNull();
  });
  it("returns null for undefined", () => {
    expect(parseTensao(undefined)).toBeNull();
  });
});

describe("parsePotencia", () => {
  it("returns 10 for '10W/m'", () => {
    expect(parsePotencia("10W/m")).toBe(10);
  });
  it("returns 5 for '5W'", () => {
    expect(parsePotencia("5W")).toBe(5);
  });
  it("returns 38 for '38W'", () => {
    expect(parsePotencia("38W")).toBe(38);
  });
  it("returns 2.5 for '2,5W' (vírgula decimal)", () => {
    expect(parsePotencia("2,5W")).toBe(2.5);
  });
  it("returns 2.5 for '2.5W' (ponto decimal)", () => {
    expect(parsePotencia("2.5W")).toBe(2.5);
  });
  it("returns null for empty string", () => {
    expect(parsePotencia("")).toBeNull();
  });
  it("returns null for null", () => {
    expect(parsePotencia(null)).toBeNull();
  });
  it("returns null for 'abc'", () => {
    expect(parsePotencia("abc")).toBeNull();
  });
});

describe("mapMasterRow", () => {
  it("maps a Fita LED row: watts_por_metro filled, potencia_watts null", () => {
    const row = {
      SKU: "LM2847",
      produto_id: "P0001",
      Variante_Nome: "Fita LED 10W/m 24V",
      Categoria: "Fitas e Drivers",
      Tipologia: "Fita LED",
      Variante_Tensao: "24V DC",
      Variante_Potencia: "10W/m",
      Variante_Lumens: 800,
    };
    const out = mapMasterRow(row);
    expect(out.sku).toBe("LM2847");
    expect(out.produto_id).toBe("P0001");
    expect(out.tipologia).toBe("Fita LED");
    expect(out.tensao).toBe(24);
    expect(out.watts_por_metro).toBe(10);
    expect(out.potencia_watts).toBeNull();
    expect(out.atributos.lumens).toBe(800);
    expect(out.atributos.tensao_raw).toBe("24V DC");
  });

  it("maps a Luminária row: potencia_watts filled, watts_por_metro null", () => {
    const row = {
      SKU: "VL5000",
      produto_id: "P0010",
      Variante_Nome: "VISION 5W",
      Categoria: "Sistemas Lineares",
      Tipologia: "Spot",
      Variante_Tensao: "127V/220V",
      Variante_Potencia: "5W",
      Variante_IRC: 90,
    };
    const out = mapMasterRow(row);
    expect(out.sku).toBe("VL5000");
    expect(out.tipologia).toBe("Spot");
    expect(out.potencia_watts).toBe(5);
    expect(out.watts_por_metro).toBeNull();
    expect(out.tensao).toBeNull(); // 127V/220V não é DC
    expect(out.atributos.tensao_raw).toBe("127V/220V"); // Pitfall 4 — preserva original
    expect(out.atributos.irc).toBe(90);
  });

  it("preserves tensao_raw in atributos even when parseTensao returns null (Pitfall 4)", () => {
    const row = {
      SKU: "ABC123",
      produto_id: "P0001",
      Variante_Nome: "Test",
      Categoria: "X",
      Tipologia: "Y",
      Variante_Tensao: "250V",
    };
    const out = mapMasterRow(row);
    expect(out.tensao).toBeNull();
    expect(out.atributos.tensao_raw).toBe("250V");
  });

  it("returns sensible defaults when row has missing fields", () => {
    const row = { SKU: "X1" };
    const out = mapMasterRow(row);
    expect(out.sku).toBe("X1");
    expect(out.produto_id).toBe("");
    expect(out.variante_nome).toBe("");
    expect(out.tensao).toBeNull();
    expect(out.watts_por_metro).toBeNull();
    expect(out.potencia_watts).toBeNull();
    expect(out.cor).toBeNull();
    expect(out.largura_mm).toBeNull();
    expect(out.atributos).toBeTypeOf("object");
  });

  it("trims whitespace on string fields", () => {
    const row = { SKU: "  LM001  ", produto_id: " P0001 ", Variante_Nome: "  Test  " };
    const out = mapMasterRow(row);
    expect(out.sku).toBe("LM001");
    expect(out.produto_id).toBe("P0001");
    expect(out.variante_nome).toBe("Test");
  });
});
