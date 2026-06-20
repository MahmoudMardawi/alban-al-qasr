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
      activity_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json | null
          read_by_admin: boolean
          summary_ar: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json | null
          read_by_admin?: boolean
          summary_ar?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json | null
          read_by_admin?: boolean
          summary_ar?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chats: {
        Row: {
          created_at: string
          id: string
          messages: Json
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          owner_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chats_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          added_by: string | null
          address: string | null
          created_at: string
          id: string
          is_approved: boolean
          merged_into_client_id: string | null
          name: string
          notes: string | null
          phone: string | null
          type: string | null
        }
        Insert: {
          added_by?: string | null
          address?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          merged_into_client_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          type?: string | null
        }
        Update: {
          added_by?: string | null
          address?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          merged_into_client_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_merged_into_client_id_fkey"
            columns: ["merged_into_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          id: string
          note: string | null
          receipt_url: string | null
          recorded_by: string | null
          spent_at: string
        }
        Insert: {
          amount: number
          category: string
          id?: string
          note?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          spent_at?: string
        }
        Update: {
          amount?: number
          category?: string
          id?: string
          note?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          spent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          id: string
          method: string
          note: string | null
          paid_at: string
          recorded_by: string | null
          visit_id: string | null
        }
        Insert: {
          amount: number
          client_id: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          visit_id?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          id?: string
          method?: string
          note?: string | null
          paid_at?: string
          recorded_by?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      period_closings: {
        Row: {
          closing_qty: number | null
          created_by: string | null
          id: string
          opening_qty: number | null
          period_end: string
          period_start: string
          product_id: string
          snapshot_at: string
        }
        Insert: {
          closing_qty?: number | null
          created_by?: string | null
          id?: string
          opening_qty?: number | null
          period_end: string
          period_start: string
          product_id: string
          snapshot_at?: string
        }
        Update: {
          closing_qty?: number | null
          created_by?: string | null
          id?: string
          opening_qty?: number | null
          period_end?: string
          period_start?: string
          product_id?: string
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_closings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_closings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_packages: {
        Row: {
          contains_qty: number
          created_at: string
          id: string
          is_active: boolean
          package_name: string
          package_price: number
          product_id: string
        }
        Insert: {
          contains_qty: number
          created_at?: string
          id?: string
          is_active?: boolean
          package_name: string
          package_price: number
          product_id: string
        }
        Update: {
          contains_qty?: number
          created_at?: string
          id?: string
          is_active?: boolean
          package_name?: string
          package_price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_packages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production: {
        Row: {
          id: string
          note: string | null
          produced_at: string
          product_id: string
          qty_produced: number
          qty_wasted: number
          recorded_by: string | null
        }
        Insert: {
          id?: string
          note?: string | null
          produced_at?: string
          product_id: string
          qty_produced: number
          qty_wasted?: number
          recorded_by?: string | null
        }
        Update: {
          id?: string
          note?: string | null
          produced_at?: string
          product_id?: string
          qty_produced?: number
          qty_wasted?: number
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          base_cost: number | null
          base_price: number
          base_unit: string
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string | null
        }
        Insert: {
          base_cost?: number | null
          base_price: number
          base_unit: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en?: string | null
        }
        Update: {
          base_cost?: number | null
          base_price?: number
          base_unit?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string | null
        }
        Relationships: []
      }
      truck_load_items: {
        Row: {
          id: string
          load_id: string
          note: string | null
          product_id: string
          qty_loaded: number
          qty_returned: number
        }
        Insert: {
          id?: string
          load_id: string
          note?: string | null
          product_id: string
          qty_loaded: number
          qty_returned?: number
        }
        Update: {
          id?: string
          load_id?: string
          note?: string | null
          product_id?: string
          qty_loaded?: number
          qty_returned?: number
        }
        Relationships: [
          {
            foreignKeyName: "truck_load_items_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "truck_loads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_load_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_loads: {
        Row: {
          closed_at: string | null
          created_at: string
          employee_id: string
          id: string
          loaded_at: string
          notes: string | null
          status: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          employee_id: string
          id?: string
          loaded_at?: string
          notes?: string | null
          status?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          loaded_at?: string
          notes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_loads_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          role: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string
        }
        Relationships: []
      }
      visit_lines: {
        Row: {
          base_qty: number
          id: string
          line_type: string
          note: string | null
          package_id: string | null
          product_id: string
          qty: number
          unit_price: number | null
          visit_id: string
        }
        Insert: {
          base_qty: number
          id?: string
          line_type: string
          note?: string | null
          package_id?: string | null
          product_id: string
          qty: number
          unit_price?: number | null
          visit_id: string
        }
        Update: {
          base_qty?: number
          id?: string
          line_type?: string
          note?: string | null
          package_id?: string | null
          product_id?: string
          qty?: number
          unit_price?: number | null
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_lines_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "product_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_lines_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          client_id: string
          created_at: string
          employee_id: string
          id: string
          invoice_no: number
          notes: string | null
          visited_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          employee_id: string
          id?: string
          invoice_no?: number
          notes?: string | null
          visited_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          employee_id?: string
          id?: string
          invoice_no?: number
          notes?: string | null
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_client_money_balance: {
        Row: {
          balance: number | null
          client_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      v_client_replacement_debt: {
        Row: {
          client_id: string | null
          owed_base_qty: number | null
          product_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      auth_role: { Args: never; Returns: string }
      fn_merge_clients: {
        Args: { duplicate_ids: string[]; primary_id: string }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_employee: { Args: never; Returns: boolean }
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
