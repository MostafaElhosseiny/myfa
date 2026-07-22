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
          challenge_id: string | null
          created_at: string
          id: string
          kind: string
          message: string
          player_id: string | null
        }
        Insert: {
          challenge_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message: string
          player_id?: string | null
        }
        Update: {
          challenge_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          player_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_flags: {
        Row: {
          challenge_id: string
          flag_hash: string
          flag_order: number
          id: string
          label: string
        }
        Insert: {
          challenge_id: string
          flag_hash: string
          flag_order: number
          id?: string
          label?: string
        }
        Update: {
          challenge_id?: string
          flag_hash?: string
          flag_order?: number
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_flags_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string
          id: string
          points_per_flag: number
          required_flags: number
          title: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          points_per_flag?: number
          required_flags: number
          title: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          points_per_flag?: number
          required_flags?: number
          title?: string
        }
        Relationships: []
      }
      competition_state: {
        Row: {
          ends_at: string | null
          id: number
          status: string
          updated_at: string
        }
        Insert: {
          ends_at?: string | null
          id?: number
          status?: string
          updated_at?: string
        }
        Update: {
          ends_at?: string | null
          id?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      player_challenge_progress: {
        Row: {
          challenge_id: string
          completed_at: string | null
          flags_solved: number
          player_id: string
          points: number
          updated_at: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          flags_solved?: number
          player_id: string
          points?: number
          updated_at?: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          flags_solved?: number
          player_id?: string
          points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_challenge_progress_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_flag_solves: {
        Row: {
          challenge_id: string
          flag_hash: string
          flag_id: string
          player_id: string
          solved_at: string
        }
        Insert: {
          challenge_id: string
          flag_hash: string
          flag_id: string
          player_id: string
          solved_at?: string
        }
        Update: {
          challenge_id?: string
          flag_hash?: string
          flag_id?: string
          player_id?: string
          solved_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_flag_solves_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_flag_solves_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "challenge_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_flag_solves_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          challenges_completed: number
          created_at: string
          first_completed_at: string | null
          flags_solved: number
          id: string
          last_seen_at: string
          name_display: string
          name_lower: string
          points: number
        }
        Insert: {
          challenges_completed?: number
          created_at?: string
          first_completed_at?: string | null
          flags_solved?: number
          id?: string
          last_seen_at?: string
          name_display: string
          name_lower: string
          points?: number
        }
        Update: {
          challenges_completed?: number
          created_at?: string
          first_completed_at?: string | null
          flags_solved?: number
          id?: string
          last_seen_at?: string
          name_display?: string
          name_lower?: string
          points?: number
        }
        Relationships: []
      }
      submissions: {
        Row: {
          challenge_id: string
          correct: boolean
          flag_hash: string
          id: string
          player_id: string
          submitted_at: string
        }
        Insert: {
          challenge_id: string
          correct: boolean
          flag_hash: string
          id?: string
          player_id: string
          submitted_at?: string
        }
        Update: {
          challenge_id?: string
          correct?: boolean
          flag_hash?: string
          id?: string
          player_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
