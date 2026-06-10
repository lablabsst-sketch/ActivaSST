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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      consentimientos: {
        Row: {
          aceptado_at: string
          id: string
          revocado_at: string | null
          user_agent: string | null
          usuario_id: string
          version_aviso: string
        }
        Insert: {
          aceptado_at?: string
          id?: string
          revocado_at?: string | null
          user_agent?: string | null
          usuario_id: string
          version_aviso: string
        }
        Update: {
          aceptado_at?: string
          id?: string
          revocado_at?: string | null
          user_agent?: string | null
          usuario_id?: string
          version_aviso?: string
        }
        Relationships: [
          {
            foreignKeyName: "consentimientos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          nit: string | null
          nombre: string
          plan_id: string
          tz: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nit?: string | null
          nombre: string
          plan_id: string
          tz?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          nit?: string | null
          nombre?: string
          plan_id?: string
          tz?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresas_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      pausa_registros: {
        Row: {
          created_at: string
          duracion_real_seg: number | null
          estado: Database["public"]["Enums"]["estado_registro"]
          id: string
          motivo: string | null
          pausa_oficial_id: string | null
          programacion_id: string
          respondido_en: string
          response_uuid: string
          trabajador_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          duracion_real_seg?: number | null
          estado: Database["public"]["Enums"]["estado_registro"]
          id?: string
          motivo?: string | null
          pausa_oficial_id?: string | null
          programacion_id: string
          respondido_en?: string
          response_uuid?: string
          trabajador_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          duracion_real_seg?: number | null
          estado?: Database["public"]["Enums"]["estado_registro"]
          id?: string
          motivo?: string | null
          pausa_oficial_id?: string | null
          programacion_id?: string
          respondido_en?: string
          response_uuid?: string
          trabajador_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pausa_registros_pausa_oficial_id_fkey"
            columns: ["pausa_oficial_id"]
            isOneToOne: false
            referencedRelation: "pausas_oficiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pausa_registros_programacion_id_fkey"
            columns: ["programacion_id"]
            isOneToOne: false
            referencedRelation: "programaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pausa_registros_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pausa_tipos_trabajo: {
        Row: {
          pausa_id: string
          tipo_id: string
        }
        Insert: {
          pausa_id: string
          tipo_id: string
        }
        Update: {
          pausa_id?: string
          tipo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pausa_tipos_trabajo_pausa_id_fkey"
            columns: ["pausa_id"]
            isOneToOne: false
            referencedRelation: "pausas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pausa_tipos_trabajo_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_trabajo"
            referencedColumns: ["id"]
          },
        ]
      }
      pausas: {
        Row: {
          archivada: boolean
          creador_id: string
          created_at: string
          duracion_min: number
          empresa_id: string
          id: string
          image_url: string | null
          instrucciones: string
          titulo: string
          video_url: string | null
        }
        Insert: {
          archivada?: boolean
          creador_id: string
          created_at?: string
          duracion_min: number
          empresa_id: string
          id?: string
          image_url?: string | null
          instrucciones: string
          titulo: string
          video_url?: string | null
        }
        Update: {
          archivada?: boolean
          creador_id?: string
          created_at?: string
          duracion_min?: number
          empresa_id?: string
          id?: string
          image_url?: string | null
          instrucciones?: string
          titulo?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pausas_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pausas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pausas_oficiales: {
        Row: {
          codigo: string
          created_at: string
          duracion_min: number
          empresa_id: string | null
          id: string
          image_url: string | null
          instrucciones: string
          pack: Database["public"]["Enums"]["pausa_oficial_pack"]
          titulo: string
          video_url: string | null
        }
        Insert: {
          codigo: string
          created_at?: string
          duracion_min: number
          empresa_id?: string | null
          id?: string
          image_url?: string | null
          instrucciones: string
          pack: Database["public"]["Enums"]["pausa_oficial_pack"]
          titulo: string
          video_url?: string | null
        }
        Update: {
          codigo?: string
          created_at?: string
          duracion_min?: number
          empresa_id?: string | null
          id?: string
          image_url?: string | null
          instrucciones?: string
          pack?: Database["public"]["Enums"]["pausa_oficial_pack"]
          titulo?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pausas_oficiales_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      pausas_oficiales_ocultas: {
        Row: {
          empresa_id: string
          pausa_oficial_id: string
        }
        Insert: {
          empresa_id: string
          pausa_oficial_id: string
        }
        Update: {
          empresa_id?: string
          pausa_oficial_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pausas_oficiales_ocultas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pausas_oficiales_ocultas_pausa_oficial_id_fkey"
            columns: ["pausa_oficial_id"]
            isOneToOne: false
            referencedRelation: "pausas_oficiales"
            referencedColumns: ["id"]
          },
        ]
      }
      pausas_oficiales_tipos_trabajo: {
        Row: {
          pausa_oficial_id: string
          tipo_id: string
        }
        Insert: {
          pausa_oficial_id: string
          tipo_id: string
        }
        Update: {
          pausa_oficial_id?: string
          tipo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pausas_oficiales_tipos_trabajo_pausa_oficial_id_fkey"
            columns: ["pausa_oficial_id"]
            isOneToOne: false
            referencedRelation: "pausas_oficiales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pausas_oficiales_tipos_trabajo_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_trabajo"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          max_trabajadores: number
          nombre: string
          precio_mes_cop: number
          slug: Database["public"]["Enums"]["plan_slug"]
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          max_trabajadores: number
          nombre: string
          precio_mes_cop?: number
          slug: Database["public"]["Enums"]["plan_slug"]
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          max_trabajadores?: number
          nombre?: string
          precio_mes_cop?: number
          slug?: Database["public"]["Enums"]["plan_slug"]
        }
        Relationships: []
      }
      programacion_trabajadores: {
        Row: {
          programacion_id: string
          trabajador_id: string
        }
        Insert: {
          programacion_id: string
          trabajador_id: string
        }
        Update: {
          programacion_id?: string
          trabajador_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "programacion_trabajadores_programacion_id_fkey"
            columns: ["programacion_id"]
            isOneToOne: false
            referencedRelation: "programaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programacion_trabajadores_trabajador_id_fkey"
            columns: ["trabajador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      programaciones: {
        Row: {
          activa: boolean
          creador_id: string
          created_at: string
          dias_semana: number[]
          empresa_id: string
          horas: string[]
          id: string
          nombre: string
          pausa_oficial_id: string
          tipos_trabajo_objetivo: string[]
          updated_at: string
        }
        Insert: {
          activa?: boolean
          creador_id: string
          created_at?: string
          dias_semana?: number[]
          empresa_id: string
          horas?: string[]
          id?: string
          nombre: string
          pausa_oficial_id: string
          tipos_trabajo_objetivo?: string[]
          updated_at?: string
        }
        Update: {
          activa?: boolean
          creador_id?: string
          created_at?: string
          dias_semana?: number[]
          empresa_id?: string
          horas?: string[]
          id?: string
          nombre?: string
          pausa_oficial_id?: string
          tipos_trabajo_objetivo?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programaciones_creador_id_fkey"
            columns: ["creador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programaciones_pausa_oficial_fkey"
            columns: ["pausa_oficial_id"]
            isOneToOne: false
            referencedRelation: "pausas_oficiales"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string | null
          fcm_token: string | null
          id: string
          p256dh: string | null
          tipo: Database["public"]["Enums"]["push_tipo"]
          user_agent: string | null
          usuario_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint?: string | null
          fcm_token?: string | null
          id?: string
          p256dh?: string | null
          tipo?: Database["public"]["Enums"]["push_tipo"]
          user_agent?: string | null
          usuario_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string | null
          fcm_token?: string | null
          id?: string
          p256dh?: string | null
          tipo?: Database["public"]["Enums"]["push_tipo"]
          user_agent?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_trabajo: {
        Row: {
          id: string
          nombre: string
          slug: string
        }
        Insert: {
          id?: string
          nombre: string
          slug: string
        }
        Update: {
          id?: string
          nombre?: string
          slug?: string
        }
        Relationships: []
      }
      usuario_tipos_trabajo: {
        Row: {
          tipo_id: string
          usuario_id: string
        }
        Insert: {
          tipo_id: string
          usuario_id: string
        }
        Update: {
          tipo_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_tipos_trabajo_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_trabajo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_tipos_trabajo_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          activo: boolean
          created_at: string
          documento: string | null
          email: string
          empresa_id: string
          estado: Database["public"]["Enums"]["estado_usuario"]
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Insert: {
          activo?: boolean
          created_at?: string
          documento?: string | null
          email: string
          empresa_id: string
          estado?: Database["public"]["Enums"]["estado_usuario"]
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Update: {
          activo?: boolean
          created_at?: string
          documento?: string | null
          email?: string
          empresa_id?: string
          estado?: Database["public"]["Enums"]["estado_usuario"]
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_empresa_id: { Args: never; Returns: string }
      current_rol: {
        Args: never
        Returns: Database["public"]["Enums"]["rol_usuario"]
      }
      email_is_whitelisted: { Args: { p_email: string }; Returns: boolean }
    }
    Enums: {
      estado_registro:
        | "pendiente"
        | "hecha"
        | "rechazada"
        | "vencida"
        | "postpuesta"
      estado_usuario: "pendiente" | "activo" | "inactivo"
      pausa_oficial_pack:
        | "oficina_basico"
        | "operativo_basico"
        | "conduccion_basico"
        | "universal"
      plan_slug: "gratis" | "starter" | "growth" | "business" | "enterprise"
      push_tipo: "web" | "fcm"
      rol_usuario: "prevencionista" | "trabajador" | "empresa_admin"
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
      estado_registro: [
        "pendiente",
        "hecha",
        "rechazada",
        "vencida",
        "postpuesta",
      ],
      estado_usuario: ["pendiente", "activo", "inactivo"],
      pausa_oficial_pack: [
        "oficina_basico",
        "operativo_basico",
        "conduccion_basico",
        "universal",
      ],
      plan_slug: ["gratis", "starter", "growth", "business", "enterprise"],
      push_tipo: ["web", "fcm"],
      rol_usuario: ["prevencionista", "trabajador", "empresa_admin"],
    },
  },
} as const
