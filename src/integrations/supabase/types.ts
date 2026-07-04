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
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          jd_text: string | null
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          jd_text?: string | null
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          jd_text?: string | null
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          credits: number
          notes: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          credits: number
          notes?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          credits?: number
          notes?: string | null
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          code: string
          credited: number
          redeemed_at: string
          user_id: string
        }
        Insert: {
          code: string
          credited: number
          redeemed_at?: string
          user_id: string
        }
        Update: {
          code?: string
          credited?: number
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["code"]
          },
        ]
      }
      threads: {
        Row: {
          created_at: string
          cv_raw_text: string | null
          cv_structured: Json | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cv_raw_text?: string | null
          cv_structured?: Json | null
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cv_raw_text?: string | null
          cv_structured?: Json | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_promo_credits: {
        Row: {
          credits_granted_total: number
          credits_remaining: number
          updated_at: string
          user_id: string
        }
        Insert: {
          credits_granted_total?: number
          credits_remaining?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          credits_granted_total?: number
          credits_remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_promo_code: {
        Args: { _code: string; _credits?: number; _notes?: string }
        Returns: {
          active: boolean
          code: string
          created_at: string
          credits: number
          notes: string
        }[]
      }
      admin_list_promo_codes: {
        Args: never
        Returns: {
          active: boolean
          code: string
          created_at: string
          credits: number
          notes: string
          redemptions: number
        }[]
      }
      admin_promo_stats: {
        Args: never
        Returns: {
          active_codes: number
          total_codes: number
          total_credits_granted: number
          total_credits_remaining: number
          total_credits_used: number
          total_redemptions: number
          unique_redeemers: number
        }[]
      }
      admin_set_promo_code_active: {
        Args: { _active: boolean; _code: string }
        Returns: boolean
      }
      is_admin_email: { Args: never; Returns: boolean }
      is_promo_admin: { Args: never; Returns: boolean }
      redeem_promo_code: {
        Args: { _code: string }
        Returns: {
          code: string
          credits: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
