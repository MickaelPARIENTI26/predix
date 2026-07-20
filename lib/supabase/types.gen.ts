export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_events: {
        Row: {
          actor_user_id: string | null
          competition_id: string
          created_at: string
          detail: Json
          id: number
          kind: string
          target_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          competition_id: string
          created_at?: string
          detail?: Json
          id?: never
          kind: string
          target_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          competition_id?: string
          created_at?: string
          detail?: Json
          id?: never
          kind?: string
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_events_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_members: {
        Row: {
          competition_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          competition_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          competition_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_members_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invite_code: string
          name: string
          owner_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_teams: {
        Row: {
          final_rank: number | null
          group_id: string
          team_id: string
        }
        Insert: {
          final_rank?: number | null
          group_id: string
          team_id: string
        }
        Update: {
          final_rank?: number | null
          group_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_teams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          name: string
          ranking_lock_at: string | null
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          name: string
          ranking_lock_at?: string | null
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          name?: string
          ranking_lock_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      knockout_stages: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          kind: string
          lock_at: string | null
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          kind: string
          lock_at?: string | null
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          kind?: string
          lock_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knockout_stages_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          competition_id: string
          created_at: string
          group_id: string | null
          home_score: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string
          label: string | null
          stage: string
          status: string
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          competition_id: string
          created_at?: string
          group_id?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at: string
          label?: string | null
          stage?: string
          status?: string
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          competition_id?: string
          created_at?: string
          group_id?: string | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string
          label?: string | null
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_events: {
        Row: {
          base_version: number | null
          client_sent_at: string | null
          competition_id: string
          conflict_current_version: number | null
          device_id: string | null
          event_uuid: string
          id: number
          lock_at: string | null
          outcome: string
          payload: Json
          previous_payload: Json | null
          resulting_version: number | null
          server_received_at: string
          target_id: string
          target_kind: string
          user_id: string
        }
        Insert: {
          base_version?: number | null
          client_sent_at?: string | null
          competition_id: string
          conflict_current_version?: number | null
          device_id?: string | null
          event_uuid: string
          id?: never
          lock_at?: string | null
          outcome: string
          payload: Json
          previous_payload?: Json | null
          resulting_version?: number | null
          server_received_at: string
          target_id: string
          target_kind: string
          user_id: string
        }
        Update: {
          base_version?: number | null
          client_sent_at?: string | null
          competition_id?: string
          conflict_current_version?: number | null
          device_id?: string | null
          event_uuid?: string
          id?: never
          lock_at?: string | null
          outcome?: string
          payload?: Json
          previous_payload?: Json | null
          resulting_version?: number | null
          server_received_at?: string
          target_id?: string
          target_kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_events_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions_current: {
        Row: {
          competition_id: string
          last_event_id: number
          payload: Json
          target_id: string
          target_kind: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          competition_id: string
          last_event_id: number
          payload: Json
          target_id: string
          target_kind: string
          updated_at?: string
          user_id: string
          version: number
        }
        Update: {
          competition_id?: string
          last_event_id?: number
          payload?: Json
          target_id?: string
          target_kind?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "predictions_current_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_current_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "prediction_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_current_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      scores: {
        Row: {
          breakdown: Json
          competition_id: string
          computed_at: string
          points: number
          user_id: string
        }
        Insert: {
          breakdown?: Json
          competition_id: string
          computed_at?: string
          points?: number
          user_id: string
        }
        Update: {
          breakdown?: Json
          competition_id?: string
          computed_at?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scoring_rules: {
        Row: {
          competition_id: string
          config: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          competition_id: string
          config: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          competition_id?: string
          config?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scoring_rules_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: true
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scoring_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_adjustments: {
        Row: {
          competition_id: string
          created_at: string
          created_by: string | null
          id: number
          member_user_id: string
          points: number
          reason: string
        }
        Insert: {
          competition_id: string
          created_at?: string
          created_by?: string | null
          id?: number
          member_user_id: string
          points: number
          reason: string
        }
        Update: {
          competition_id?: string
          created_at?: string
          created_by?: string | null
          id?: number
          member_user_id?: string
          points?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_adjustments_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_adjustments_member_user_id_fkey"
            columns: ["member_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          code: string | null
          competition_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          competition_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          competition_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_manual_adjustment: {
        Args: {
          p_comp: string
          p_member: string
          p_points: number
          p_reason: string
        }
        Returns: Json
      }
      remove_manual_adjustment: {
        Args: { p_id: number }
        Returns: Json
      }
      create_competition: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "competitions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gen_invite_code: { Args: never; Returns: string }
      group_standings: {
        Args: { p_group: string }
        Returns: {
          rank: number
          team_id: string
        }[]
      }
      is_competition_member: { Args: { p_comp: string }; Returns: boolean }
      is_competition_organizer: { Args: { p_comp: string }; Returns: boolean }
      is_valid_group_ranking: {
        Args: { p_group: string; p_ranking: Json }
        Returns: boolean
      }
      join_competition: {
        Args: { p_code: string }
        Returns: {
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "competitions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prediction_competition_id: {
        Args: { p_kind: string; p_target: string }
        Returns: string
      }
      prediction_lock_at: {
        Args: { p_kind: string; p_target: string }
        Returns: string
      }
      recompute_competition_scores: {
        Args: { p_comp: string }
        Returns: undefined
      }
      save_prediction: {
        Args: {
          p_base_version?: number
          p_client_sent_at?: string
          p_device_id?: string
          p_event_uuid: string
          p_kind: string
          p_payload: Json
          p_target: string
        }
        Returns: Json
      }
      set_match_result: {
        Args: {
          p_away: number
          p_home: number
          p_match: string
          p_status?: string
        }
        Returns: Json
      }
      set_scoring_rules: {
        Args: { p_comp: string; p_config: Json }
        Returns: Json
      }
      try_uuid: { Args: { p_text: string }; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

