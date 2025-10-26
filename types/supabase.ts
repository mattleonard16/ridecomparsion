/**
 * Supabase Database Types
 * Generate fresh types with: npx supabase gen types typescript --project-id YOUR_PROJECT_ID
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          preferred_service: 'uber' | 'lyft' | 'taxi' | null
          notification_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          preferred_service?: 'uber' | 'lyft' | 'taxi' | null
          notification_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          preferred_service?: 'uber' | 'lyft' | 'taxi' | null
          notification_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      routes: {
        Row: {
          id: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          destination_address: string
          destination_lat: number
          destination_lng: number
          distance_miles: number | null
          duration_minutes: number | null
          route_hash: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          destination_address: string
          destination_lat: number
          destination_lng: number
          distance_miles?: number | null
          duration_minutes?: number | null
          route_hash?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          destination_address?: string
          destination_lat?: number
          destination_lng?: number
          distance_miles?: number | null
          duration_minutes?: number | null
          route_hash?: string
          created_at?: string
          updated_at?: string
        }
      }
      price_snapshots: {
        Row: {
          id: string
          route_id: string
          service_type: 'uber' | 'lyft' | 'taxi'
          base_price: number
          surge_multiplier: number
          final_price: number
          wait_time_minutes: number | null
          drivers_nearby: number | null
          weather_condition: string | null
          weather_temp_f: number | null
          is_raining: boolean
          traffic_level: 'light' | 'moderate' | 'heavy' | 'severe' | null
          nearby_events: string[]
          day_of_week: number
          hour_of_day: number
          is_holiday: boolean
          confidence: number | null
          timestamp: string
        }
        Insert: {
          id?: string
          route_id: string
          service_type: 'uber' | 'lyft' | 'taxi'
          base_price: number
          surge_multiplier?: number
          final_price: number
          wait_time_minutes?: number | null
          drivers_nearby?: number | null
          weather_condition?: string | null
          weather_temp_f?: number | null
          is_raining?: boolean
          traffic_level?: 'light' | 'moderate' | 'heavy' | 'severe' | null
          nearby_events?: string[]
          day_of_week?: number
          hour_of_day?: number
          is_holiday?: boolean
          confidence?: number | null
          timestamp?: string
        }
        Update: {
          id?: string
          route_id?: string
          service_type?: 'uber' | 'lyft' | 'taxi'
          base_price?: number
          surge_multiplier?: number
          final_price?: number
          wait_time_minutes?: number | null
          drivers_nearby?: number | null
          weather_condition?: string | null
          weather_temp_f?: number | null
          is_raining?: boolean
          traffic_level?: 'light' | 'moderate' | 'heavy' | 'severe' | null
          nearby_events?: string[]
          day_of_week?: number
          hour_of_day?: number
          is_holiday?: boolean
          confidence?: number | null
          timestamp?: string
        }
      }
      saved_routes: {
        Row: {
          id: string
          user_id: string
          route_id: string
          nickname: string | null
          is_favorite: boolean
          notification_enabled: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          route_id: string
          nickname?: string | null
          is_favorite?: boolean
          notification_enabled?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          route_id?: string
          nickname?: string | null
          is_favorite?: boolean
          notification_enabled?: boolean
          created_at?: string
        }
      }
      price_alerts: {
        Row: {
          id: string
          user_id: string
          route_id: string
          service_type: 'uber' | 'lyft' | 'taxi' | 'any'
          target_price: number
          alert_type: 'below' | 'above'
          is_active: boolean
          last_triggered_at: string | null
          trigger_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          route_id: string
          service_type?: 'uber' | 'lyft' | 'taxi' | 'any'
          target_price: number
          alert_type?: 'below' | 'above'
          is_active?: boolean
          last_triggered_at?: string | null
          trigger_count?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          route_id?: string
          service_type?: 'uber' | 'lyft' | 'taxi' | 'any'
          target_price?: number
          alert_type?: 'below' | 'above'
          is_active?: boolean
          last_triggered_at?: string | null
          trigger_count?: number
          created_at?: string
          updated_at?: string
        }
      }
      search_logs: {
        Row: {
          id: string
          user_id: string | null
          route_id: string | null
          session_id: string | null
          ip_address: string | null
          user_agent: string | null
          results_shown: Json | null
          did_book: boolean
          booked_service: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          route_id?: string | null
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          results_shown?: Json | null
          did_book?: boolean
          booked_service?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          route_id?: string | null
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
          results_shown?: Json | null
          did_book?: boolean
          booked_service?: string | null
        }
      }
      weather_logs: {
        Row: {
          id: string
          lat: number
          lng: number
          temperature_f: number | null
          condition: string | null
          precipitation_inch: number | null
          wind_speed_mph: number | null
          visibility_miles: number | null
          is_severe: boolean
          raw_data: Json | null
          logged_at: string
        }
        Insert: {
          id?: string
          lat: number
          lng: number
          temperature_f?: number | null
          condition?: string | null
          precipitation_inch?: number | null
          wind_speed_mph?: number | null
          visibility_miles?: number | null
          is_severe?: boolean
          raw_data?: Json | null
          logged_at?: string
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          temperature_f?: number | null
          condition?: string | null
          precipitation_inch?: number | null
          wind_speed_mph?: number | null
          visibility_miles?: number | null
          is_severe?: boolean
          raw_data?: Json | null
          logged_at?: string
        }
      }
      event_logs: {
        Row: {
          id: string
          event_name: string
          venue_name: string | null
          venue_lat: number | null
          venue_lng: number | null
          event_type: string | null
          start_time: string
          end_time: string | null
          expected_attendance: number | null
          ticket_price_range: string | null
          raw_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          event_name: string
          venue_name?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          event_type?: string | null
          start_time: string
          end_time?: string | null
          expected_attendance?: number | null
          ticket_price_range?: string | null
          raw_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          event_name?: string
          venue_name?: string | null
          venue_lat?: number | null
          venue_lng?: number | null
          event_type?: string | null
          start_time?: string
          end_time?: string | null
          expected_attendance?: number | null
          ticket_price_range?: string | null
          raw_data?: Json | null
          created_at?: string
        }
      }
      traffic_logs: {
        Row: {
          id: string
          route_id: string
          traffic_level: 'light' | 'moderate' | 'heavy' | 'severe' | null
          delay_minutes: number | null
          incidents: Json | null
          logged_at: string
        }
        Insert: {
          id?: string
          route_id: string
          traffic_level?: 'light' | 'moderate' | 'heavy' | 'severe' | null
          delay_minutes?: number | null
          incidents?: Json | null
          logged_at?: string
        }
        Update: {
          id?: string
          route_id?: string
          traffic_level?: 'light' | 'moderate' | 'heavy' | 'severe' | null
          delay_minutes?: number | null
          incidents?: Json | null
          logged_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_route_price_history: {
        Args: {
          p_route_id: string
          p_days_back?: number
        }
        Returns: {
          service_type: string
          timestamp: string
          final_price: number
          surge_multiplier: number
        }[]
      }
      get_hourly_price_average: {
        Args: {
          p_route_id: string
          p_service: string
        }
        Returns: {
          hour: number
          avg_price: number
          sample_count: number
        }[]
      }
    }
    Enums: {
      traffic_level: 'light' | 'moderate' | 'heavy' | 'severe'
    }
  }
}
