import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Loader2, ImageIcon } from "lucide-react";
import ArquitetoAutocomplete from "@/components/ArquitetoAutocomplete";
import { uploadProdutoImagem, UploadProdutoImagemError } from "@/lib/uploadProdutoImagem";

export interface ProdutoEditRow {
  id: string;
  codigo: string;
  descricao: string;
  nome?: string | null;
  preco_tabela: number | null;
  preco_minimo: number | null;
  arquiteto_id: string | null;
  imagem_url?: string | null;
}

interface ProdutoEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  produto: ProdutoEditRow | null;
  onSuccess: () => void;
}

const ProdutoEditDialog = ({ open, onOpenChange, mode, produto, onSuccess }: ProdutoEditDialogProps) => {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [precoTabela, setPrecoTabela] = useState("");
  const [precoMinimo, setPrecoMinimo] = useState("");
  const [arquitetoId, setArquitetoId] = useState<string | null>(null);
  const [arquitetoNome, setArquitetoNome] = useState("");
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && produto) {
      setCodigo(produto.codigo || "");
      setNome(produto.nome || "");
      setDescricao(produto.descricao || "");
      setPrecoTabela(produto.preco_tabela != null ? String(produto.preco_tabela) : "");
      setPrecoMinimo(produto.preco_minimo != null ? String(produto.preco_minimo) : "");
      setArquitetoId(produto.arquiteto_id);
      setImagemUrl(produto.imagem_url ?? null);
      if (produto.arquiteto_id) {
        supabase
          .from("arquitetos")
          .select("nome")
          .eq("id", produto.arquiteto_id)
          .maybeSingle()
          .then(({ data }) => {
            setArquitetoNome(data?.nome || "");
          });
      } else {
        setArquitetoNome("");
      }
    } else {
      // mode === "create"
      setCodigo("");
      setNome("");
      setDescricao("");
      setPrecoTabela("");
      setPrecoMinimo("");
      setArquitetoId(null);
      setArquitetoNome("");
      setImagemUrl(null);
    }
  }, [open, mode, produto]);

  const handleImageClick = () => {
    if (mode === "create" && !codigo.trim()) {
      toast.error("Preencha o código antes de subir a imagem (o nome do arquivo será o código).");
      return;
    }
    fileRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const codigoForUpload = mode === "create" ? codigo.trim() : produto?.codigo || codigo.trim();
    if (!codigoForUpload) {
      toast.error("Código do produto é obrigatório para upload.");
      return;
    }
    setUploading(true);
    try {
      const { publicUrl } = await uploadProdutoImagem(codigoForUpload, file);
      setImagemUrl(publicUrl);
      toast.success("Imagem enviada");
    } catch (err) {
      if (err instanceof UploadProdutoImagemError) {
        toast.error(err.message);
      } else {
        toast.error("Erro inesperado no upload");
      }
    } finally {
      setUploading(false);
      // limpa o input pra permitir re-upload do mesmo arquivo
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const parsePreco = (raw: string): { value: number | null; ok: boolean } => {
    const trimmed = raw.trim();
    if (!trimmed) return { value: null, ok: true };
    const n = Number(trimmed.replace(",", "."));
    return { value: n, ok: !Number.isNaN(n) };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    if (mode === "create" && !codigo.trim()) {
      toast.error("Código é obrigatório");
      return;
    }
    if (mode === "create" && !nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const pt = parsePreco(precoTabela);
    if (!pt.ok) {
      toast.error("Preço tabela inválido");
      return;
    }
    const pm = parsePreco(precoMinimo);
    if (!pm.ok) {
      toast.error("Preço mínimo inválido");
      return;
    }

    setSaving(true);

    if (mode === "create") {
      // INSERT em product_variants direto (a view produtos não permite write — Pitfall 1 RESEARCH)
      // origem='manual' (D-08 + RESEARCH Open Question 1), editado_manualmente=true (admin acabou de criar)
      // product_id = P-LEGADO (o reagrupamento manual é phase futura — Deferred Idea CONTEXT)
      const { data: legadoParent, error: parentErr } = await supabase
        .from("products")
        .select("id")
        .eq("codigo_pai", "P-LEGADO")
        .maybeSingle();

      if (parentErr || !legadoParent) {
        setSaving(false);
        toast.error("Pai P-LEGADO não encontrado. Migration Phase 3 aplicada?");
        return;
      }

      const { error } = await supabase
        .from("product_variants")
        .insert({
          codigo: codigo.trim(),
          nome: nome.trim(),
          descricao: descricao.trim(),
          preco_tabela: pt.value ?? 0,
          preco_minimo: pm.value ?? 0,
          arquiteto_id: arquitetoId,
          imagem_url: imagemUrl,
          product_id: legadoParent.id,
          origem: "manual",
          editado_manualmente: true,
          atributos: {},
        });

      setSaving(false);
      if (error) {
        toast.error("Erro ao criar produto: " + error.message);
        return;
      }
      toast.success("Produto criado!");
      onOpenChange(false);
      onSuccess();
    } else {
      // mode === "edit" — UPDATE direto em product_variants (NÃO em produtos — view)
      // D-08: setar editado_manualmente=true em qualquer save via UI
      if (!produto) {
        setSaving(false);
        return;
      }
      const { error } = await supabase
        .from("product_variants")
        .update({
          descricao: descricao.trim(),
          nome: nome.trim() || null,
          preco_tabela: pt.value ?? 0,
          preco_minimo: pm.value ?? 0,
          arquiteto_id: arquitetoId,
          imagem_url: imagemUrl,
          editado_manualmente: true, // D-08
        })
        .eq("id", produto.id);

      setSaving(false);
      if (error) {
        toast.error("Erro ao salvar: " + error.message);
        return;
      }
      toast.success("Produto atualizado!");
      onOpenChange(false);
      onSuccess();
    }
  };

  const title = mode === "create" ? "Novo Produto" : "Editar Produto";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="prod-codigo">Código {mode === "create" && <span className="text-destructive">*</span>}</Label>
            <Input
              id="prod-codigo"
              value={mode === "edit" ? produto?.codigo || "" : codigo}
              onChange={(e) => mode === "create" && setCodigo(e.target.value.trim())}
              disabled={mode === "edit"}
              className="font-mono"
              placeholder={mode === "create" ? "Ex: LM9999" : ""}
            />
            <p className="text-xs text-muted-foreground">
              {mode === "edit"
                ? "Código é fixo (chave de correlação com importação CSV)."
                : "SKU único (apenas letras, números, hífen, underscore)."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-nome">Nome {mode === "create" && <span className="text-destructive">*</span>}</Label>
            <Input
              id="prod-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: VISION 5W"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prod-desc">Descrição <span className="text-destructive">*</span></Label>
            <Input
              id="prod-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="prod-pt">Preço Tabela</Label>
              <Input
                id="prod-pt"
                inputMode="decimal"
                placeholder="0.00"
                value={precoTabela}
                onChange={(e) => setPrecoTabela(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-pm">Preço Mínimo</Label>
              <Input
                id="prod-pm"
                inputMode="decimal"
                placeholder="0.00"
                value={precoMinimo}
                onChange={(e) => setPrecoMinimo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Arquiteto</Label>
            <ArquitetoAutocomplete
              value={arquitetoNome}
              onSelect={(arq) => {
                if (arq === null) {
                  setArquitetoId(null);
                  setArquitetoNome("");
                } else {
                  setArquitetoId(arq.id);
                  setArquitetoNome(arq.nome);
                }
              }}
              placeholder="Buscar arquiteto..."
            />
          </div>

          <div className="space-y-2">
            <Label>Imagem</Label>
            <div className="flex items-center gap-3">
              {imagemUrl ? (
                <img
                  src={imagemUrl}
                  alt="Preview"
                  className="h-16 w-16 rounded border object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted">
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleImageChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleImageClick}
                disabled={uploading || saving}
              >
                {uploading ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Upload className="mr-1 h-4 w-4" /> {imagemUrl ? "Trocar imagem" : "Fazer upload"}</>
                )}
              </Button>
              {imagemUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setImagemUrl(null)} disabled={uploading || saving}>
                  Remover
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP — máx 2MB. Nome do arquivo é gerado a partir do código.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving || uploading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || uploading || !descricao.trim() || (mode === "create" && (!codigo.trim() || !nome.trim()))}>
              {saving ? "Salvando..." : mode === "create" ? "Criar Produto" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProdutoEditDialog;
