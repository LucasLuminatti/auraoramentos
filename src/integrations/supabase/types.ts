Initialising login role...
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: []
      }
      allowed_users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      arquitetos: {
        Row: {
          contato: string | null
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          contato?: string | null
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          contato?: string | null
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      arquivo_pastas: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          nome: string
          pasta_pai_id: string | null
          projeto_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          nome: string
          pasta_pai_id?: string | null
          projeto_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          nome?: string
          pasta_pai_id?: string | null
          projeto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arquivo_pastas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivo_pastas_pasta_pai_id_fkey"
            columns: ["pasta_pai_id"]
            isOneToOne: false
            referencedRelation: "arquivo_pastas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arquivo_pastas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_arquivos: {
        Row: {
          arquivo_path: string
          arquivo_url: string
          categoria: string
          cliente_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          pasta_id: string | null
          projeto_id: string | null
          tamanho: number
        }
        Insert: {
          arquivo_path: string
          arquivo_url: string
          categoria?: string
          cliente_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          pasta_id?: string | null
          projeto_id?: string | null
          tamanho?: number
        }
        Update: {
          arquivo_path?: string
          arquivo_url?: string
          categoria?: string
          cliente_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          pasta_id?: string | null
          projeto_id?: string | null
          tamanho?: number
        }
        Relationships: [
          {
            foreignKeyName: "cliente_arquivos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_arquivos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "arquivo_pastas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_arquivos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          arquiteto_id: string | null
          contato: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          arquiteto_id?: string | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          arquiteto_id?: string | null
          contato?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_arquiteto_id_fkey"
            columns: ["arquiteto_id"]
            isOneToOne: false
            referencedRelation: "arquitetos"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          cargo: string | null
          cpf: string | null
          created_at: string
          departamento: string | null
          id: string
          nome: string
          setor: string | null
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          departamento?: string | null
          id?: string
          nome: string
          setor?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          departamento?: string | null
          id?: string
          nome?: string
          setor?: string | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      exception_messages: {
        Row: {
          content: string
          created_at: string
          exception_id: string
          id: string
          user_id: string
          user_name: string
        }
        Insert: {
          content: string
          created_at?: string
          exception_id: string
          id?: string
          user_id: string
          user_name: string
        }
        Update: {
          content?: string
          created_at?: string
          exception_id?: string
          id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "exception_messages_exception_id_fkey"
            columns: ["exception_id"]
            isOneToOne: false
            referencedRelation: "price_exceptions"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          ambientes: Json
          cliente_id: string
          colaborador_id: string
          created_at: string
          data: string
          fechado_at: string | null
          id: string
          motivo_perda: string | null
          motivo_perda_detalhe: string | null
          projeto_id: string | null
          status: string
          tipo: string | null
          valor: number
        }
        Insert: {
          ambientes?: Json
          cliente_id: string
          colaborador_id: string
          created_at?: string
          data?: string
          fechado_at?: string | null
          id?: string
          motivo_perda?: string | null
          motivo_perda_detalhe?: string | null
          projeto_id?: string | null
          status?: string
          tipo?: string | null
          valor?: number
        }
        Update: {
          ambientes?: Json
          cliente_id?: string
          colaborador_id?: string
          created_at?: string
          data?: string
          fechado_at?: string | null
          id?: string
          motivo_perda?: string | null
          motivo_perda_detalhe?: string | null
          projeto_id?: string | null
          status?: string
          tipo?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      price_exceptions: {
        Row: {
          created_at: string
          id: string
          orcamento_id: string | null
          preco_minimo: number
          preco_solicitado: number
          produto_codigo: string
          produto_descricao: string
          projeto_id: string | null
          resolvido_at: string | null
          resolvido_por: string | null
          solicitante_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          orcamento_id?: string | null
          preco_minimo: number
          preco_solicitado: number
          produto_codigo: string
          produto_descricao: string
          projeto_id?: string | null
          resolvido_at?: string | null
          resolvido_por?: string | null
          solicitante_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          orcamento_id?: string | null
          preco_minimo?: number
          preco_solicitado?: number
          produto_codigo?: string
          produto_descricao?: string
          projeto_id?: string | null
          resolvido_at?: string | null
          resolvido_por?: string | null
          solicitante_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_exceptions_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          aplicacao: string | null
          arquiteto_id: string | null
          codigo: string
          cor: string | null
          created_at: string
          descricao: string
          driver_max_watts: number | null
          driver_tipo_permitido: string | null
          familia_perfil: string | null
          fator_spot: number | null
          id: string
          imagem_url: string | null
          largura_canal_mm: number | null
          largura_mm: number | null
          passadas_padrao: number | null
          potencia_watts: number | null
          preco_minimo: number
          preco_tabela: number
          sistema: string | null
          somente_baby: boolean | null
          subtipo: string | null
          tamanho_rolo_m: number | null
          tensao: number | null
          tipo_produto: string | null
          watts_por_metro: number | null
        }
        Insert: {
          aplicacao?: string | null
          arquiteto_id?: string | null
          codigo: string
          cor?: string | null
          created_at?: string
          descricao: string
          driver_max_watts?: number | null
          driver_tipo_permitido?: string | null
          familia_perfil?: string | null
          fator_spot?: number | null
          id?: string
          imagem_url?: string | null
          largura_canal_mm?: number | null
          largura_mm?: number | null
          passadas_padrao?: number | null
          potencia_watts?: number | null
          preco_minimo?: number
          preco_tabela?: number
          sistema?: string | null
          somente_baby?: boolean | null
          subtipo?: string | null
          tamanho_rolo_m?: number | null
          tensao?: number | null
          tipo_produto?: string | null
          watts_por_metro?: number | null
        }
        Update: {
          aplicacao?: string | null
          arquiteto_id?: string | null
          codigo?: string
          cor?: string | null
          created_at?: string
          descricao?: string
          driver_max_watts?: number | null
          driver_tipo_permitido?: string | null
          familia_perfil?: string | null
          fator_spot?: number | null
          id?: string
          imagem_url?: string | null
          largura_canal_mm?: number | null
          largura_mm?: number | null
          passadas_padrao?: number | null
          potencia_watts?: number | null
          preco_minimo?: number
          preco_tabela?: number
          sistema?: string | null
          somente_baby?: boolean | null
          subtipo?: string | null
          tamanho_rolo_m?: number | null
          tensao?: number | null
          tipo_produto?: string | null
          watts_por_metro?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_arquiteto_id_fkey"
            columns: ["arquiteto_id"]
            isOneToOne: false
            referencedRelation: "arquitetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          cliente_id: string
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_compatibilidade_perfil: {
        Row: {
          created_at: string
          driver_max_watts: number | null
          driver_tipo_aceito: string
          familia_perfil: string
          id: string
          largura_max_fita_mm: number | null
          passadas_padrao: number
          sistemas_compativeis: string[]
          somente_baby: boolean
        }
        Insert: {
          created_at?: string
          driver_max_watts?: number | null
          driver_tipo_aceito?: string
          familia_perfil: string
          id?: string
          largura_max_fita_mm?: number | null
          passadas_padrao?: number
          sistemas_compativeis?: string[]
          somente_baby?: boolean
        }
        Update: {
          created_at?: string
          driver_max_watts?: number | null
          driver_tipo_aceito?: string
          familia_perfil?: string
          id?: string
          largura_max_fita_mm?: number | null
          passadas_padrao?: number
          sistemas_compativeis?: string[]
          somente_baby?: boolean
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vinculos_spot_lampada: {
        Row: {
          codigo_lampada: string
          codigo_spot: string
          created_at: string
          id: string
          led_integrado: boolean
          tipo_lampada: string | null
        }
        Insert: {
          codigo_lampada: string
          codigo_spot: string
          created_at?: string
          id?: string
          led_integrado?: boolean
          tipo_lampada?: string | null
        }
        Update: {
          codigo_lampada?: string
          codigo_spot?: string
          created_at?: string
          id?: string
          led_integrado?: boolean
          tipo_lampada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_spot_lampada_codigo_lampada_fkey"
            columns: ["codigo_lampada"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["codigo"]
          },
          {
            foreignKeyName: "vinculos_spot_lampada_codigo_spot_fkey"
            columns: ["codigo_spot"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["codigo"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_conectores_emenda: {
        Args: { p_qtd_cantos: number; p_qtd_perfis: number }
        Returns: Json
      }
      calcular_drivers: {
        Args: {
          p_metragem_fita: number
          p_potencia_driver: number
          p_tensao: number
          p_watts_por_metro: number
        }
        Returns: number
      }
      calcular_drivers_magneto_48v: {
        Args: { p_potencia_total_modulos: number }
        Returns: Json
      }
      calcular_metragem_fita: {
        Args: {
          p_comprimento_perfil: number
          p_num_passadas: number
          p_quantidade_pecas: number
        }
        Returns: number
      }
      calcular_tampa_cega_smode: {
        Args: { p_comprimento_perfil: number; p_comprimentos_modulos: number[] }
        Returns: Json
      }
      calcular_tampas_vedacao_fita_flexivel: {
        Args: { p_qtd_sessoes: number }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      otimizar_rolos_fita: { Args: { p_demanda_metros: number }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
A new version of Supabase CLI is available: v2.90.0 (currently installed v2.78.1)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
