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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          center_id: string
          created_at: string
          id: string
          person_code: string | null
          person_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          center_id: string
          created_at?: string
          id?: string
          person_code?: string | null
          person_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          center_id?: string
          created_at?: string
          id?: string
          person_code?: string | null
          person_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_bank: {
        Row: {
          adaptations: string | null
          area: string
          center_id: string | null
          created_at: string
          duration_min: number | null
          id: string
          materials: string | null
          steps: string[]
          support_level: string | null
          title: string
        }
        Insert: {
          adaptations?: string | null
          area: string
          center_id?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          materials?: string | null
          steps?: string[]
          support_level?: string | null
          title: string
        }
        Update: {
          adaptations?: string | null
          area?: string
          center_id?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          materials?: string | null
          steps?: string[]
          support_level?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_bank_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_results: {
        Row: {
          activity_id: string
          center_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          person_id: string | null
          result: Database["public"]["Enums"]["result_kind"]
          result_date: string
          support_used: string | null
        }
        Insert: {
          activity_id: string
          center_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          person_id?: string | null
          result: Database["public"]["Enums"]["result_kind"]
          result_date?: string
          support_used?: string | null
        }
        Update: {
          activity_id?: string
          center_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          person_id?: string | null
          result?: Database["public"]["Enums"]["result_kind"]
          result_date?: string
          support_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_results_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "plan_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_results_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_results_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          created_at: string
          created_by: string
          id: string
          join_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          join_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          join_code?: string
          name?: string
        }
        Relationships: []
      }
      persons: {
        Row: {
          age_range: string
          anonymized: boolean
          autonomy: Json
          center_id: string
          code: string
          communication: string | null
          consent_date: string | null
          consent_grantor: string | null
          consent_purpose: string | null
          consent_status: Database["public"]["Enums"]["consent_status"]
          created_at: string
          created_by: string | null
          diagnosis: string | null
          id: string
          likes: string | null
          main_type: string
          routines: string | null
          sensitivities: string | null
          supports: string | null
          updated_at: string
        }
        Insert: {
          age_range: string
          anonymized?: boolean
          autonomy?: Json
          center_id: string
          code: string
          communication?: string | null
          consent_date?: string | null
          consent_grantor?: string | null
          consent_purpose?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          likes?: string | null
          main_type: string
          routines?: string | null
          sensitivities?: string | null
          supports?: string | null
          updated_at?: string
        }
        Update: {
          age_range?: string
          anonymized?: boolean
          autonomy?: Json
          center_id?: string
          code?: string
          communication?: string | null
          consent_date?: string | null
          consent_grantor?: string | null
          consent_purpose?: string | null
          consent_status?: Database["public"]["Enums"]["consent_status"]
          created_at?: string
          created_by?: string | null
          diagnosis?: string | null
          id?: string
          likes?: string | null
          main_type?: string
          routines?: string | null
          sensitivities?: string | null
          supports?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "persons_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_activities: {
        Row: {
          adaptations: string | null
          ai_generated: boolean
          approved_at: string | null
          approved_by: string | null
          area: string
          center_id: string
          created_at: string
          day_of_week: number | null
          duration_min: number | null
          id: string
          materials: string | null
          objective_id: string | null
          plan_id: string
          position: number
          status: Database["public"]["Enums"]["item_status"]
          steps: string[]
          support_level: string | null
          time_slot: string | null
          title: string
        }
        Insert: {
          adaptations?: string | null
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          area: string
          center_id: string
          created_at?: string
          day_of_week?: number | null
          duration_min?: number | null
          id?: string
          materials?: string | null
          objective_id?: string | null
          plan_id: string
          position?: number
          status?: Database["public"]["Enums"]["item_status"]
          steps?: string[]
          support_level?: string | null
          time_slot?: string | null
          title: string
        }
        Update: {
          adaptations?: string | null
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          area?: string
          center_id?: string
          created_at?: string
          day_of_week?: number | null
          duration_min?: number | null
          id?: string
          materials?: string | null
          objective_id?: string | null
          plan_id?: string
          position?: number
          status?: Database["public"]["Enums"]["item_status"]
          steps?: string[]
          support_level?: string | null
          time_slot?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_activities_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_activities_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "plan_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_activities_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_objectives: {
        Row: {
          ai_generated: boolean
          approved_at: string | null
          approved_by: string | null
          area: string
          center_id: string
          created_at: string
          criterion: string | null
          deadline: string | null
          description: string
          id: string
          indicator: string | null
          parent_objective_id: string | null
          plan_id: string
          status: Database["public"]["Enums"]["item_status"]
        }
        Insert: {
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          area: string
          center_id: string
          created_at?: string
          criterion?: string | null
          deadline?: string | null
          description: string
          id?: string
          indicator?: string | null
          parent_objective_id?: string | null
          plan_id: string
          status?: Database["public"]["Enums"]["item_status"]
        }
        Update: {
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          area?: string
          center_id?: string
          created_at?: string
          criterion?: string | null
          deadline?: string | null
          description?: string
          id?: string
          indicator?: string | null
          parent_objective_id?: string | null
          plan_id?: string
          status?: Database["public"]["Enums"]["item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "plan_objectives_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_objectives_parent_objective_id_fkey"
            columns: ["parent_objective_id"]
            isOneToOne: false
            referencedRelation: "plan_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_objectives_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          center_id: string
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          is_template: boolean
          level: Database["public"]["Enums"]["plan_level"]
          objectives: string | null
          parent_id: string | null
          person_id: string | null
          start_date: string | null
          title: string
        }
        Insert: {
          center_id: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_template?: boolean
          level: Database["public"]["Enums"]["plan_level"]
          objectives?: string | null
          parent_id?: string | null
          person_id?: string | null
          start_date?: string | null
          title: string
        }
        Update: {
          center_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          is_template?: boolean
          level?: Database["public"]["Enums"]["plan_level"]
          objectives?: string | null
          parent_id?: string | null
          person_id?: string | null
          start_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          center_id: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          center_id?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          center_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          ai_generated: boolean
          approved_at: string | null
          approved_by: string | null
          center_id: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          period_end: string
          period_start: string
          person_id: string
          stats: Json
          status: Database["public"]["Enums"]["item_status"]
        }
        Insert: {
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          center_id: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_end: string
          period_start: string
          person_id: string
          stats?: Json
          status?: Database["public"]["Enums"]["item_status"]
        }
        Update: {
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          center_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          person_id?: string
          stats?: Json
          status?: Database["public"]["Enums"]["item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          center_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          center_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          center_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      anonymize_person: { Args: { _person_id: string }; Returns: undefined }
      approve_item: { Args: { _id: string; _kind: string }; Returns: undefined }
      assign_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      create_center: { Args: { _name: string }; Returns: string }
      current_center_id: { Args: never; Returns: string }
      duplicate_week: {
        Args: { _new_start: string; _plan_id: string }
        Returns: string
      }
      export_person: { Args: { _person_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: never; Returns: boolean }
      join_center: { Args: { _code: string }; Returns: string }
      load_demo_data: { Args: never; Returns: string }
      log_access: {
        Args: { _action: string; _person_id: string }
        Returns: undefined
      }
      regenerate_join_code: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "educador" | "profesional" | "familia"
      consent_status: "pendiente" | "otorgado" | "retirado"
      item_status: "borrador" | "aprobado"
      plan_level: "anual" | "mensual" | "semanal" | "diaria"
      result_kind:
        | "lograda"
        | "lograda_con_apoyo"
        | "no_lograda"
        | "no_realizada"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "educador", "profesional", "familia"],
      consent_status: ["pendiente", "otorgado", "retirado"],
      item_status: ["borrador", "aprobado"],
      plan_level: ["anual", "mensual", "semanal", "diaria"],
      result_kind: [
        "lograda",
        "lograda_con_apoyo",
        "no_lograda",
        "no_realizada",
      ],
    },
  },
} as const
