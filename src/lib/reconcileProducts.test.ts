import { describe, it, expect } from "vitest";
import { reconcile, type DbVariantRow } from "./reconcileProducts";
import type { MasterVariantRow } from "./productAttributes";

const masterRow = (sku: string, overrides: Partial<MasterVariantRow> = {}): MasterVariantRow => ({
  sku,
  produto_id: "P0001",
  variante_nome: `Variante ${sku}`,
  categoria: "Cat",
  tipologia: "Spot",
  atributos: { lumens: 100 },
  tensao: 24,
  watts_por_metro: null,
  potencia_watts: 5,
  largura_mm: null,
  cor: "Preto",
  ...overrides,
});

const dbRow = (codigo: string, overrides: Partial<DbVariantRow> = {}): DbVariantRow => ({
  id: `uuid-${codigo}`,
  codigo,
  product_id: "uuid-parent",
  origem: "legado",
  editado_manualmente: false,
  arquiteto_id: null,
  preco_tabela: 100,
  preco_minimo: 80,
  ...overrides,
});

describe("reconcile", () => {
  it("D-07: SKU only in master goes to creates", () => {
    const master = [masterRow("LM001")];
    const db: DbVariantRow[] = [];
    const report = reconcile(master, db);
    expect(report.creates).toHaveLength(1);
    expect(report.creates[0].sku).toBe("LM001");
    expect(report.updates).toHaveLength(0);
    expect(report.skipped).toHaveLength(0);
    expect(report.legados_preserved).toHaveLength(0);
  });

  it("D-06: SKU only in DB goes to legados_preserved (not touched)", () => {
    const master: MasterVariantRow[] = [];
    const db = [dbRow("OLD001"), dbRow("OLD002")];
    const report = reconcile(master, db);
    expect(report.legados_preserved).toEqual(["OLD001", "OLD002"]);
    expect(report.creates).toHaveLength(0);
    expect(report.updates).toHaveLength(0);
    expect(report.skipped).toHaveLength(0);
  });

  it("D-05: SKU in both, editado_manualmente=false, origem!=coringa → goes to updates", () => {
    const master = [masterRow("LM001", { variante_nome: "VISION 5W" })];
    const db = [dbRow("LM001", { origem: "legado", editado_manualmente: false })];
    const report = reconcile(master, db);
    expect(report.updates).toHaveLength(1);
    expect(report.updates[0].sku).toBe("LM001");
    expect(report.updates[0].id).toBe("uuid-LM001");
    expect(report.updates[0].patch.nome).toBe("VISION 5W");
    expect(report.updates[0].patch.origem).toBe("master");
  });

  it("D-05 INVARIANT: patch NEVER includes arquiteto_id, preco_tabela, preco_minimo, editado_manualmente", () => {
    const master = [masterRow("LM001")];
    const db = [dbRow("LM001", { editado_manualmente: false, arquiteto_id: "uuid-arq", preco_tabela: 999, preco_minimo: 700 })];
    const report = reconcile(master, db);
    expect(report.updates).toHaveLength(1);
    const patch = report.updates[0].patch;
    expect("arquiteto_id" in patch).toBe(false);
    expect("preco_tabela" in patch).toBe(false);
    expect("preco_minimo" in patch).toBe(false);
    expect("editado_manualmente" in patch).toBe(false);
  });

  it("D-08: SKU with editado_manualmente=true → skipped (master does NOT override)", () => {
    const master = [masterRow("LM001")];
    const db = [dbRow("LM001", { editado_manualmente: true })];
    const report = reconcile(master, db);
    expect(report.skipped).toEqual([{ sku: "LM001", reason: "editado_manualmente" }]);
    expect(report.updates).toHaveLength(0);
    expect(report.creates).toHaveLength(0);
  });

  it("D-10: SKU with origem='coringa' → skipped (master does NOT override AU)", () => {
    const master = [masterRow("AU001")];
    const db = [dbRow("AU001", { origem: "coringa", editado_manualmente: true })];
    const report = reconcile(master, db);
    expect(report.skipped).toEqual([{ sku: "AU001", reason: "origem_coringa" }]);
    expect(report.updates).toHaveLength(0);
  });

  it("D-10: coringa skipped takes precedence over editado_manualmente", () => {
    // SKU é coringa MAS também tem editado_manualmente=false (cenário improvável mas possível)
    const master = [masterRow("AU001")];
    const db = [dbRow("AU001", { origem: "coringa", editado_manualmente: false })];
    const report = reconcile(master, db);
    expect(report.skipped).toEqual([{ sku: "AU001", reason: "origem_coringa" }]);
  });

  it("update patch contains nome, atributos, tensao, watts_por_metro, potencia_watts, cor, largura_mm, origem", () => {
    const master = [masterRow("LM001", {
      variante_nome: "Test Variant",
      atributos: { lumens: 200, irc: 90 },
      tensao: 12,
      watts_por_metro: 8,
      potencia_watts: null,
      cor: "Branco",
      largura_mm: null,
    })];
    const db = [dbRow("LM001")];
    const report = reconcile(master, db);
    const patch = report.updates[0].patch;
    expect(patch.nome).toBe("Test Variant");
    expect(patch.atributos).toEqual({ lumens: 200, irc: 90 });
    expect(patch.tensao).toBe(12);
    expect(patch.watts_por_metro).toBe(8);
    expect(patch.potencia_watts).toBeNull();
    expect(patch.cor).toBe("Branco");
    expect(patch.largura_mm).toBeNull();
    expect(patch.origem).toBe("master");
  });

  it("mixed scenario: 1 create + 1 update + 1 skipped + 1 legado", () => {
    const master = [
      masterRow("NEW001"),                                      // create
      masterRow("UPD001", { variante_nome: "Updated Name" }),   // update
      masterRow("AU001"),                                       // skipped (coringa)
    ];
    const db = [
      dbRow("UPD001", { editado_manualmente: false }),
      dbRow("AU001", { origem: "coringa", editado_manualmente: true }),
      dbRow("LEG001"),                                          // legado preservado
    ];
    const report = reconcile(master, db);
    expect(report.creates).toHaveLength(1);
    expect(report.creates[0].sku).toBe("NEW001");
    expect(report.updates).toHaveLength(1);
    expect(report.updates[0].sku).toBe("UPD001");
    expect(report.skipped).toEqual([{ sku: "AU001", reason: "origem_coringa" }]);
    expect(report.legados_preserved).toEqual(["LEG001"]);
  });

  it("empty master + empty db → all empty", () => {
    const report = reconcile([], []);
    expect(report.creates).toHaveLength(0);
    expect(report.updates).toHaveLength(0);
    expect(report.skipped).toHaveLength(0);
    expect(report.legados_preserved).toHaveLength(0);
  });

  it("empty db → all master rows go to creates", () => {
    const master = [masterRow("A"), masterRow("B"), masterRow("C")];
    const report = reconcile(master, []);
    expect(report.creates).toHaveLength(3);
    expect(report.updates).toHaveLength(0);
    expect(report.legados_preserved).toHaveLength(0);
  });

  it("empty master → all db rows preserved as legados", () => {
    const db = [dbRow("X"), dbRow("Y")];
    const report = reconcile([], db);
    expect(report.legados_preserved).toEqual(["X", "Y"]);
    expect(report.creates).toHaveLength(0);
  });
});
