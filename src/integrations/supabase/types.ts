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
      ai_usage: {
        Row: {
          calls: number
          day: string
          user_id: string
        }
        Insert: {
          calls?: number
          day?: string
          user_id?: string
        }
        Update: {
          calls?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      clusters: {
        Row: {
          cluster_id: number
          hue: number | null
          label: string | null
          member_count: number
          summary: string | null
          user_id: string
        }
        Insert: {
          cluster_id: number
          hue?: number | null
          label?: string | null
          member_count?: number
          summary?: string | null
          user_id?: string
        }
        Update: {
          cluster_id?: number
          hue?: number | null
          label?: string | null
          member_count?: number
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string | null
          connected_on: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          position: string | null
          show_in_graph: boolean
          url: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          connected_on?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          position?: string | null
          show_in_graph?: boolean
          url?: string | null
          user_id?: string
        }
        Update: {
          company?: string | null
          connected_on?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          position?: string | null
          show_in_graph?: boolean
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      edges: {
        Row: {
          a: string
          b: string
          components: Json | null
          created_at: string
          evidence: Json | null
          explanation: string | null
          id: string
          kind: string
          score: number
          user_feedback: number | null
          user_id: string
          validated: boolean | null
        }
        Insert: {
          a: string
          b: string
          components?: Json | null
          created_at?: string
          evidence?: Json | null
          explanation?: string | null
          id?: string
          kind?: string
          score: number
          user_feedback?: number | null
          user_id?: string
          validated?: boolean | null
        }
        Update: {
          a?: string
          b?: string
          components?: Json | null
          created_at?: string
          evidence?: Json | null
          explanation?: string | null
          id?: string
          kind?: string
          score?: number
          user_feedback?: number | null
          user_id?: string
          validated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "edges_a_fkey"
            columns: ["a"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edges_b_fkey"
            columns: ["b"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          id: string
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          id?: string
          kind?: string
          name: string
          user_id?: string
        }
        Update: {
          id?: string
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      graph_settings: {
        Row: {
          cos_max: number
          cos_min: number
          daily_ai_cap: number
          max_degree: number
          quality: string
          show_people: boolean
          threshold: number
          top_k: number
          updated_at: string
          user_id: string
          w_ent: number
          w_expl: number
          w_kw: number
          w_sem: number
          w_tmp: number
        }
        Insert: {
          cos_max?: number
          cos_min?: number
          daily_ai_cap?: number
          max_degree?: number
          quality?: string
          show_people?: boolean
          threshold?: number
          top_k?: number
          updated_at?: string
          user_id?: string
          w_ent?: number
          w_expl?: number
          w_kw?: number
          w_sem?: number
          w_tmp?: number
        }
        Update: {
          cos_max?: number
          cos_min?: number
          daily_ai_cap?: number
          max_degree?: number
          quality?: string
          show_people?: boolean
          threshold?: number
          top_k?: number
          updated_at?: string
          user_id?: string
          w_ent?: number
          w_expl?: number
          w_kw?: number
          w_sem?: number
          w_tmp?: number
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          kind: string
          last_error: string | null
          note_id: string | null
          payload: Json | null
          run_after: string
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          kind: string
          last_error?: string | null
          note_id?: string | null
          payload?: Json | null
          run_after?: string
          status?: string
          user_id?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          note_id?: string | null
          payload?: Json | null
          run_after?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_entities: {
        Row: {
          entity_id: string
          note_id: string
          user_id: string
        }
        Insert: {
          entity_id: string
          note_id: string
          user_id?: string
        }
        Update: {
          entity_id?: string
          note_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_entities_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_entities_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_tags: {
        Row: {
          note_id: string
          source: string
          tag_id: string
          user_id: string
        }
        Insert: {
          note_id: string
          source?: string
          tag_id: string
          user_id?: string
        }
        Update: {
          note_id?: string
          source?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          ai_status: string
          cluster_id: number | null
          content: string
          created_at: string
          embedding: string | null
          enriched: string | null
          event_date: string | null
          fts: unknown
          id: string
          is_demo: boolean
          is_private: boolean
          last_opened_at: string | null
          open_count: number
          pinned: boolean
          pos_x: number | null
          pos_y: number | null
          pos_z: number | null
          source_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          ai_status?: string
          cluster_id?: number | null
          content?: string
          created_at?: string
          embedding?: string | null
          enriched?: string | null
          event_date?: string | null
          fts?: unknown
          id?: string
          is_demo?: boolean
          is_private?: boolean
          last_opened_at?: string | null
          open_count?: number
          pinned?: boolean
          pos_x?: number | null
          pos_y?: number | null
          pos_z?: number | null
          source_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Update: {
          ai_status?: string
          cluster_id?: number | null
          content?: string
          created_at?: string
          embedding?: string | null
          enriched?: string | null
          event_date?: string | null
          fts?: unknown
          id?: string
          is_demo?: boolean
          is_private?: boolean
          last_opened_at?: string | null
          open_count?: number
          pinned?: boolean
          pos_x?: number | null
          pos_y?: number | null
          pos_z?: number | null
          source_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      sources: {
        Row: {
          created_at: string
          extracted_text: string | null
          folder: string | null
          id: string
          kind: string
          uri: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          folder?: string | null
          id?: string
          kind: string
          uri?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          folder?: string | null
          id?: string
          kind?: string
          uri?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          id: string
          name: string
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          user_id?: string
        }
        Update: {
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_notes: {
        Args: {
          exclude_id?: string
          match_count?: number
          query_embedding: string
        }
        Returns: {
          id: string
          similarity: number
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
    Enums: {},
  },
} as const
