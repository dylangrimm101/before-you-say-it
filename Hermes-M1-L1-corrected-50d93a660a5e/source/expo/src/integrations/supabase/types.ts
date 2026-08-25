// AUTO-GENERATED — DO NOT EDIT
// Run migrations to regenerate.

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
      bysi_events: {
        Row: {
          anon_id: string
          checkout_provider: string | null
          copied_section: string | null
          created_at: string
          event_name: string
          guardrail_category: string | null
          id: string
          intent_length_bucket: string | null
          metadata: Json | null
          negative_pattern: string | null
          output_version: string | null
          price_cents: number | null
          purchase_id: string | null
          raw_message_length_bucket: string | null
          result_mode: string | null
          sendable_rating: string | null
          session_id: string | null
          situation_type: string | null
          source: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          anon_id: string
          checkout_provider?: string | null
          copied_section?: string | null
          created_at?: string
          event_name: string
          guardrail_category?: string | null
          id?: string
          intent_length_bucket?: string | null
          metadata?: Json | null
          negative_pattern?: string | null
          output_version?: string | null
          price_cents?: number | null
          purchase_id?: string | null
          raw_message_length_bucket?: string | null
          result_mode?: string | null
          sendable_rating?: string | null
          session_id?: string | null
          situation_type?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          anon_id?: string
          checkout_provider?: string | null
          copied_section?: string | null
          created_at?: string
          event_name?: string
          guardrail_category?: string | null
          id?: string
          intent_length_bucket?: string | null
          metadata?: Json | null
          negative_pattern?: string | null
          output_version?: string | null
          price_cents?: number | null
          purchase_id?: string | null
          raw_message_length_bucket?: string | null
          result_mode?: string | null
          sendable_rating?: string | null
          session_id?: string | null
          situation_type?: string | null
          source?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          api_version: string | null
          event_type: string
          id: string
          livemode: boolean
          object_id: string | null
          processed_at: string | null
          processing_status: string
          received_at: string
          stripe_created_at: string
          stripe_event_id: string
        }
        Insert: {
          api_version?: string | null
          event_type: string
          id?: string
          livemode: boolean
          object_id?: string | null
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          stripe_created_at: string
          stripe_event_id: string
        }
        Update: {
          api_version?: string | null
          event_type?: string
          id?: string
          livemode?: boolean
          object_id?: string | null
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          stripe_created_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      bysi_funnel_by_situation: {
        Row: {
          activations: number | null
          follow_through_clicks: number | null
          forecasts: number | null
          purchases: number | null
          situation_type: string | null
          submissions: number | null
          submitter_to_activation_rate: number | null
        }
        Relationships: []
      }
      bysi_funnel_by_source: {
        Row: {
          activations: number | null
          campaign: string | null
          checkout_starts: number | null
          content: string | null
          follow_through_clicks: number | null
          forecast_to_purchase_rate: number | null
          forecasts: number | null
          guardrails: number | null
          medium: string | null
          paid_plans_copied: number | null
          paid_plans_generated: number | null
          paid_unlocks: number | null
          purchases: number | null
          starts: number | null
          submissions: number | null
          submitter_to_activation_rate: number | null
          traffic_source: string | null
          visitor_to_submission_rate: number | null
          visitors: number | null
        }
        Relationships: []
      }
      bysi_funnel_daily: {
        Row: {
          activations: number | null
          checkout_starts: number | null
          day: string | null
          follow_through_clicks: number | null
          forecast_to_purchase_rate: number | null
          forecasts: number | null
          guardrails: number | null
          paid_plans_copied: number | null
          paid_plans_generated: number | null
          paid_unlocks: number | null
          purchases: number | null
          starts: number | null
          submissions: number | null
          submitter_to_activation_rate: number | null
          visitor_to_submission_rate: number | null
          visitors: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      user_id: { Args: never; Returns: string }
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
