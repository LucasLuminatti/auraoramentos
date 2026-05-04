import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseMasterXlsx, ParseMasterError } from "./parseMasterXlsx";

function makeWorkbook(sheets: Record<string, Record<string, unknown>[]>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return out as ArrayBuffer;
}

describe("parseMasterXlsx", () => {
  it("parses a workbook with Variantes + Produtos sheets", () => {
    const buffer = makeWorkbook({
      Produtos: [
        { produto_id: "P0001", Categoria: "Sistemas Lineares", Tipologia: "Spot" },
        { produto_id: "P0002", Categoria: "Fitas e Drivers", Tipologia: "Fita LED" },
      ],
      Variantes: [
        { SKU: "LM001", produto_id: "P0001", Variante_Nome: "VISION 5W", Categoria: "Sistemas Lineares", Tipologia: "Spot", Variante_Tensao: "24V DC", Variante_Potencia: "5W" },
        { SKU: "LM002", produto_id: "P0001", Variante_Nome: "VISION 10W", Categoria: "Sistemas Lineares", Tipologia: "Spot", Variante_Tensao: "24V DC", Variante_Potencia: "10W" },
        { SKU: "FT001", produto_id: "P0002", Variante_Nome: "Fita LED 24V", Categoria: "Fitas e Drivers", Tipologia: "Fita LED", Variante_Tensao: "24V DC", Variante_Potencia: "10W/m" },
      ],
    });

    const out = parseMasterXlsx(buffer);
    expect(out.products).toHaveLength(2);
    expect(out.products.find((p) => p.codigo_pai === "P0001")).toBeDefined();
    expect(out.variants).toHaveLength(3);
    expect(out.variants[0].sku).toBe("LM001");
    expect(out.variants[0].tensao).toBe(24);
    expect(out.variants[0].potencia_watts).toBe(5);
    expect(out.variants[2].watts_por_metro).toBe(10);
    expect(out.variants[2].potencia_watts).toBeNull();
  });

  it("falls back to Base Completa (flat) when Variantes is missing", () => {
    const buffer = makeWorkbook({
      "Base Completa (flat)": [
        { SKU: "X1", produto_id: "P0099", Variante_Nome: "Test", Categoria: "C", Tipologia: "T" },
      ],
    });
    const out = parseMasterXlsx(buffer);
    expect(out.variants).toHaveLength(1);
    expect(out.variants[0].sku).toBe("X1");
  });

  it("throws ParseMasterError MISSING_SHEET when no Variantes/Base Completa", () => {
    const buffer = makeWorkbook({ Outras: [{ foo: "bar" }] });
    expect(() => parseMasterXlsx(buffer)).toThrow(ParseMasterError);
  });

  it("throws EMPTY_SHEET when Variantes is empty", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([["SKU", "produto_id"]]); // header only
    XLSX.utils.book_append_sheet(wb, ws, "Variantes");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    expect(() => parseMasterXlsx(out)).toThrow(/vazia|EMPTY/i);
  });

  it("filters out variants with empty SKU", () => {
    const buffer = makeWorkbook({
      Variantes: [
        { SKU: "VALID", produto_id: "P1", Variante_Nome: "X" },
        { SKU: "", produto_id: "P1", Variante_Nome: "Empty SKU" },
        { SKU: "  ", produto_id: "P1", Variante_Nome: "Whitespace SKU" },
      ],
    });
    const out = parseMasterXlsx(buffer);
    expect(out.variants).toHaveLength(1);
    expect(out.variants[0].sku).toBe("VALID");
  });

  it("derives products from variants when Produtos sheet is absent", () => {
    const buffer = makeWorkbook({
      Variantes: [
        { SKU: "A1", produto_id: "P0001", Variante_Nome: "A", Categoria: "Cat A", Tipologia: "Tip A" },
        { SKU: "A2", produto_id: "P0001", Variante_Nome: "A2", Categoria: "Cat A", Tipologia: "Tip A" },
        { SKU: "B1", produto_id: "P0002", Variante_Nome: "B", Categoria: "Cat B", Tipologia: "Tip B" },
      ],
    });
    const out = parseMasterXlsx(buffer);
    expect(out.products).toHaveLength(2);
    const p1 = out.products.find((p) => p.codigo_pai === "P0001")!;
    expect(p1.nome).toBe("Cat A — Tip A");
    expect(p1.categoria).toBe("Cat A");
    expect(p1.tipologia).toBe("Tip A");
  });

  it("dedupes products by produto_id", () => {
    const buffer = makeWorkbook({
      Variantes: [
        { SKU: "X1", produto_id: "P0001", Variante_Nome: "X1" },
        { SKU: "X2", produto_id: "P0001", Variante_Nome: "X2" },
        { SKU: "X3", produto_id: "P0001", Variante_Nome: "X3" },
      ],
    });
    const out = parseMasterXlsx(buffer);
    expect(out.products).toHaveLength(1);
    expect(out.products[0].codigo_pai).toBe("P0001");
  });
});
