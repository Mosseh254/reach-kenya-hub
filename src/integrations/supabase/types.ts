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
      activations: {
        Row: {
          approved_posts: number
          campaign_id: string
          created_at: string
          expires_at: string
          id: string
          order_id: string
          package_id: string
          starts_at: string
          status: Database["public"]["Enums"]["activation_status"]
          user_id: string
        }
        Insert: {
          approved_posts?: number
          campaign_id: string
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          package_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["activation_status"]
          user_id: string
        }
        Update: {
          approved_posts?: number
          campaign_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          package_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["activation_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activations_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      advertisers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          tagline: string
          website_url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          tagline?: string
          website_url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          tagline?: string
          website_url?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta?: Json
        }
        Relationships: []
      }
      campaign_materials: {
        Row: {
          asset_url: string | null
          campaign_id: string
          caption_text: string | null
          id: string
          kind: string
          sort_order: number
          title: string
        }
        Insert: {
          asset_url?: string | null
          campaign_id: string
          caption_text?: string | null
          id?: string
          kind: string
          sort_order?: number
          title: string
        }
        Update: {
          asset_url?: string | null
          campaign_id?: string
          caption_text?: string | null
          id?: string
          kind?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_materials_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          advertiser_id: string
          brief: string
          cover_url: string | null
          created_at: string
          cta_url: string
          id: string
          is_active: boolean
          title: string
        }
        Insert: {
          advertiser_id: string
          brief?: string
          cover_url?: string | null
          created_at?: string
          cta_url: string
          id?: string
          is_active?: boolean
          title: string
        }
        Update: {
          advertiser_id?: string
          brief?: string
          cover_url?: string | null
          created_at?: string
          cta_url?: string
          id?: string
          is_active?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_advertiser_id_fkey"
            columns: ["advertiser_id"]
            isOneToOne: false
            referencedRelation: "advertisers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_kes: number
          campaign_id: string
          created_at: string
          failure_reason: string | null
          id: string
          mpesa_receipt: string | null
          package_id: string
          paid_at: string | null
          phone: string
          provider: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["order_status"]
          user_id: string
        }
        Insert: {
          amount_kes: number
          campaign_id: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          mpesa_receipt?: string | null
          package_id: string
          paid_at?: string | null
          phone: string
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          user_id: string
        }
        Update: {
          amount_kes?: number
          campaign_id?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          mpesa_receipt?: string | null
          package_id?: string
          paid_at?: string | null
          phone?: string
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          duration_days: number
          features: Json
          id: string
          is_active: boolean
          max_posts_per_day: number
          max_rewarded_posts: number
          name: string
          price_kes: number
          reward_per_post_kes: number
          slug: string
          sort_order: number
          tagline: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_days: number
          features?: Json
          id?: string
          is_active?: boolean
          max_posts_per_day?: number
          max_rewarded_posts: number
          name: string
          price_kes: number
          reward_per_post_kes: number
          slug: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_days?: number
          features?: Json
          id?: string
          is_active?: boolean
          max_posts_per_day?: number
          max_rewarded_posts?: number
          name?: string
          price_kes?: number
          reward_per_post_kes?: number
          slug?: string
          sort_order?: number
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          order_id: string | null
          payload: Json
          provider: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          order_id?: string | null
          payload?: Json
          provider: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          phone: string | null
          referral_code: string | null
          referred_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          phone?: string | null
          referral_code?: string | null
          referred_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          bonus_kes: number | null
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          rewarded_at: string | null
          status: string
        }
        Insert: {
          bonus_kes?: number | null
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          rewarded_at?: string | null
          status?: string
        }
        Update: {
          bonus_kes?: number | null
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          rewarded_at?: string | null
          status?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          activation_id: string
          campaign_id: string
          created_at: string
          file_sha256: string
          file_size_bytes: number
          fraud_flags: Json
          fraud_score: number
          id: string
          mime_type: string
          note: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reward_kes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_path: string
          submitted_on: string
          user_id: string
        }
        Insert: {
          activation_id: string
          campaign_id: string
          created_at?: string
          file_sha256: string
          file_size_bytes: number
          fraud_flags?: Json
          fraud_score?: number
          id?: string
          mime_type: string
          note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reward_kes?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          storage_path: string
          submitted_on?: string
          user_id: string
        }
        Update: {
          activation_id?: string
          campaign_id?: string
          created_at?: string
          file_sha256?: string
          file_size_bytes?: number
          fraud_flags?: Json
          fraud_score?: number
          id?: string
          mime_type?: string
          note?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          reward_kes?: number | null
          status?: Database["public"]["Enums"]["submission_status"]
          storage_path?: string
          submitted_on?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_activation_id_fkey"
            columns: ["activation_id"]
            isOneToOne: false
            referencedRelation: "activations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_kes: number
          balance_after_kes: number
          created_at: string
          description: string
          id: string
          ref_id: string | null
          ref_type: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Insert: {
          amount_kes: number
          balance_after_kes: number
          created_at?: string
          description?: string
          id?: string
          ref_id?: string | null
          ref_type?: string | null
          type: Database["public"]["Enums"]["wallet_tx_type"]
          user_id: string
        }
        Update: {
          amount_kes?: number
          balance_after_kes?: number
          created_at?: string
          description?: string
          id?: string
          ref_id?: string | null
          ref_type?: string | null
          type?: Database["public"]["Enums"]["wallet_tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance_kes: number
          lifetime_earned_kes: number
          lifetime_withdrawn_kes: number
          pending_kes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_kes?: number
          lifetime_earned_kes?: number
          lifetime_withdrawn_kes?: number
          pending_kes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_kes?: number
          lifetime_earned_kes?: number
          lifetime_withdrawn_kes?: number
          pending_kes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount_kes: number
          created_at: string
          id: string
          mpesa_receipt: string | null
          phone: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_kes: number
          created_at?: string
          id?: string
          mpesa_receipt?: string | null
          phone: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_kes?: number
          created_at?: string
          id?: string
          mpesa_receipt?: string | null
          phone?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_confirm_order_paid: {
        Args: {
          p_order_id: string
          p_payload: Json
          p_provider_ref: string
          p_receipt: string
        }
        Returns: string
      }
      app_create_submission: {
        Args: {
          p_activation_id: string
          p_mime: string
          p_note: string
          p_sha256: string
          p_size: number
          p_storage_path: string
          p_user_id: string
        }
        Returns: {
          activation_id: string
          campaign_id: string
          created_at: string
          file_sha256: string
          file_size_bytes: number
          fraud_flags: Json
          fraud_score: number
          id: string
          mime_type: string
          note: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reward_kes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_path: string
          submitted_on: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_expire_activations: { Args: never; Returns: number }
      app_fail_order: {
        Args: { p_order_id: string; p_payload: Json; p_reason: string }
        Returns: undefined
      }
      app_is_admin: { Args: never; Returns: boolean }
      app_log_audit: {
        Args: {
          p_action: string
          p_actor: string
          p_actor_type: string
          p_entity_id: string
          p_entity_type: string
          p_meta: Json
        }
        Returns: undefined
      }
      app_process_withdrawal: {
        Args: {
          p_admin: string
          p_decision: string
          p_note: string
          p_receipt: string
          p_withdrawal_id: string
        }
        Returns: {
          admin_note: string | null
          amount_kes: number
          created_at: string
          id: string
          mpesa_receipt: string | null
          phone: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_release_approved_rewards: { Args: never; Returns: number }
      app_request_withdrawal: {
        Args: { p_amount: number; p_phone: string; p_user_id: string }
        Returns: {
          admin_note: string | null
          amount_kes: number
          created_at: string
          id: string
          mpesa_receipt: string | null
          phone: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      app_review_submission: {
        Args: {
          p_decision: string
          p_note: string
          p_reviewer: string
          p_submission_id: string
        }
        Returns: {
          activation_id: string
          campaign_id: string
          created_at: string
          file_sha256: string
          file_size_bytes: number
          fraud_flags: Json
          fraud_score: number
          id: string
          mime_type: string
          note: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reward_kes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_path: string
          submitted_on: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      confirm_order_paid: {
        Args: {
          p_order_id: string
          p_payload: Json
          p_provider_ref: string
          p_receipt: string
        }
        Returns: string
      }
      create_submission: {
        Args: {
          p_activation_id: string
          p_mime: string
          p_note: string
          p_sha256: string
          p_size: number
          p_storage_path: string
          p_user_id: string
        }
        Returns: {
          activation_id: string
          campaign_id: string
          created_at: string
          file_sha256: string
          file_size_bytes: number
          fraud_flags: Json
          fraud_score: number
          id: string
          mime_type: string
          note: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reward_kes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_path: string
          submitted_on: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_activations: { Args: never; Returns: number }
      fail_order: {
        Args: { p_order_id: string; p_payload: Json; p_reason: string }
        Returns: undefined
      }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit: {
        Args: {
          p_action: string
          p_actor: string
          p_actor_type: string
          p_entity_id: string
          p_entity_type: string
          p_meta: Json
        }
        Returns: undefined
      }
      process_withdrawal: {
        Args: {
          p_admin: string
          p_decision: string
          p_note: string
          p_receipt: string
          p_withdrawal_id: string
        }
        Returns: {
          admin_note: string | null
          amount_kes: number
          created_at: string
          id: string
          mpesa_receipt: string | null
          phone: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      relay_http_post: {
        Args: { p_body: Json; p_headers: Json; p_url: string }
        Returns: number
      }
      relay_http_result: { Args: { p_request_id: number }; Returns: Json }
      release_approved_rewards: { Args: never; Returns: number }
      request_withdrawal: {
        Args: { p_amount: number; p_phone: string; p_user_id: string }
        Returns: {
          admin_note: string | null
          amount_kes: number
          created_at: string
          id: string
          mpesa_receipt: string | null
          phone: string
          processed_at: string | null
          processed_by: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      review_submission: {
        Args: {
          p_decision: string
          p_note: string
          p_reviewer: string
          p_submission_id: string
        }
        Returns: {
          activation_id: string
          campaign_id: string
          created_at: string
          file_sha256: string
          file_size_bytes: number
          fraud_flags: Json
          fraud_score: number
          id: string
          mime_type: string
          note: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          reward_kes: number | null
          status: Database["public"]["Enums"]["submission_status"]
          storage_path: string
          submitted_on: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      activation_status: "active" | "expired" | "revoked"
      app_role: "admin" | "user"
      notification_kind:
        | "payment"
        | "activation"
        | "submission"
        | "wallet"
        | "withdrawal"
        | "referral"
        | "system"
      order_status: "pending" | "paid" | "failed" | "cancelled"
      submission_status: "pending" | "approved" | "rejected" | "flagged"
      wallet_tx_type:
        | "reward"
        | "referral_bonus"
        | "withdrawal_hold"
        | "withdrawal_paid"
        | "withdrawal_reversed"
        | "adjustment"
      withdrawal_status: "requested" | "paid" | "rejected"
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
      activation_status: ["active", "expired", "revoked"],
      app_role: ["admin", "user"],
      notification_kind: [
        "payment",
        "activation",
        "submission",
        "wallet",
        "withdrawal",
        "referral",
        "system",
      ],
      order_status: ["pending", "paid", "failed", "cancelled"],
      submission_status: ["pending", "approved", "rejected", "flagged"],
      wallet_tx_type: [
        "reward",
        "referral_bonus",
        "withdrawal_hold",
        "withdrawal_paid",
        "withdrawal_reversed",
        "adjustment",
      ],
      withdrawal_status: ["requested", "paid", "rejected"],
    },
  },
} as const
