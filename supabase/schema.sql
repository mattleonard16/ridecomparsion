-- Supabase Schema for Rideshare App
-- Version: 1.0.0
-- Created: 2024-10-14

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geographic data

-- Users table (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  preferred_service TEXT CHECK (preferred_service IN ('uber', 'lyft', 'taxi')),
  notification_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routes master table
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pickup_address TEXT NOT NULL,
  pickup_lat DECIMAL(10, 7) NOT NULL,
  pickup_lng DECIMAL(10, 7) NOT NULL,
  destination_address TEXT NOT NULL,
  destination_lat DECIMAL(10, 7) NOT NULL,
  destination_lng DECIMAL(10, 7) NOT NULL,
  distance_miles DECIMAL(10, 2),
  duration_minutes INTEGER,
  route_hash TEXT UNIQUE GENERATED ALWAYS AS (
    MD5(pickup_lat::TEXT || ',' || pickup_lng::TEXT || '-' || 
        destination_lat::TEXT || ',' || destination_lng::TEXT)
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price snapshots (time series data)
CREATE TABLE public.price_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL CHECK (service_type IN ('uber', 'lyft', 'taxi')),
  base_price DECIMAL(10, 2) NOT NULL,
  surge_multiplier DECIMAL(3, 2) DEFAULT 1.0,
  final_price DECIMAL(10, 2) NOT NULL,
  wait_time_minutes INTEGER,
  drivers_nearby INTEGER,
  
  -- Factors that influenced this price
  weather_condition TEXT,
  weather_temp_f INTEGER,
  is_raining BOOLEAN DEFAULT false,
  traffic_level TEXT CHECK (traffic_level IN ('light', 'moderate', 'heavy', 'severe')),
  nearby_events TEXT[], -- Array of event names
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  hour_of_day INTEGER CHECK (hour_of_day BETWEEN 0 AND 23),
  is_holiday BOOLEAN DEFAULT false,
  
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for time-series queries
  INDEX idx_price_snapshots_route_time (route_id, timestamp DESC),
  INDEX idx_price_snapshots_service_time (service_type, timestamp DESC)
);

-- User saved routes
CREATE TABLE public.saved_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  nickname TEXT,
  is_favorite BOOLEAN DEFAULT false,
  notification_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, route_id)
);

-- Price alerts
CREATE TABLE public.price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  service_type TEXT CHECK (service_type IN ('uber', 'lyft', 'taxi', 'any')),
  target_price DECIMAL(10, 2) NOT NULL,
  alert_type TEXT CHECK (alert_type IN ('below', 'above')) DEFAULT 'below',
  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search logs for analytics
CREATE TABLE public.search_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  session_id TEXT,
  ip_address INET,
  user_agent TEXT,
  search_timestamp TIMESTAMPTZ DEFAULT NOW(),
  results_shown JSONB, -- Store the prices shown to user
  did_book BOOLEAN DEFAULT false,
  booked_service TEXT
);

-- Weather logs (from external API)
CREATE TABLE public.weather_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lat DECIMAL(10, 7) NOT NULL,
  lng DECIMAL(10, 7) NOT NULL,
  temperature_f INTEGER,
  condition TEXT,
  precipitation_inch DECIMAL(5, 2),
  wind_speed_mph INTEGER,
  visibility_miles DECIMAL(5, 2),
  is_severe BOOLEAN DEFAULT false,
  raw_data JSONB,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Keep only recent data
  INDEX idx_weather_location_time (lat, lng, logged_at DESC)
);

-- Event logs (concerts, sports, etc)
CREATE TABLE public.event_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name TEXT NOT NULL,
  venue_name TEXT,
  venue_lat DECIMAL(10, 7),
  venue_lng DECIMAL(10, 7),
  event_type TEXT, -- concert, sports, festival, conference
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  expected_attendance INTEGER,
  ticket_price_range TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_events_time (start_time, end_time),
  INDEX idx_events_location (venue_lat, venue_lng)
);

-- Traffic conditions (from external API)
CREATE TABLE public.traffic_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  traffic_level TEXT CHECK (traffic_level IN ('light', 'moderate', 'heavy', 'severe')),
  delay_minutes INTEGER,
  incidents JSONB, -- Array of incidents along route
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_traffic_route_time (route_id, logged_at DESC)
);

-- Row Level Security Policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users can view own profile" 
  ON public.user_profiles 
  FOR SELECT 
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON public.user_profiles 
  FOR UPDATE 
  USING (auth.uid() = id);

-- Users can only see their own saved routes
CREATE POLICY "Users can view own saved routes" 
  ON public.saved_routes 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Users can only see their own alerts
CREATE POLICY "Users can view own alerts" 
  ON public.price_alerts 
  FOR ALL 
  USING (auth.uid() = user_id);

-- Public tables (no RLS needed)
-- routes, price_snapshots, search_logs, weather_logs, event_logs, traffic_logs

-- Functions for common queries
CREATE OR REPLACE FUNCTION get_route_price_history(
  p_route_id UUID,
  p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  service_type TEXT,
  timestamp TIMESTAMPTZ,
  final_price DECIMAL,
  surge_multiplier DECIMAL
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ps.service_type,
    ps.timestamp,
    ps.final_price,
    ps.surge_multiplier
  FROM price_snapshots ps
  WHERE ps.route_id = p_route_id
    AND ps.timestamp >= NOW() - INTERVAL '1 day' * p_days_back
  ORDER BY ps.timestamp DESC;
END;
$$;

-- Function to get average price by hour
CREATE OR REPLACE FUNCTION get_hourly_price_average(
  p_route_id UUID,
  p_service TEXT
)
RETURNS TABLE (
  hour INTEGER,
  avg_price DECIMAL,
  sample_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    EXTRACT(HOUR FROM timestamp)::INTEGER as hour,
    AVG(final_price)::DECIMAL as avg_price,
    COUNT(*)::BIGINT as sample_count
  FROM price_snapshots
  WHERE route_id = p_route_id
    AND service_type = p_service
    AND timestamp >= NOW() - INTERVAL '30 days'
  GROUP BY hour
  ORDER BY hour;
END;
$$;

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at 
  BEFORE UPDATE ON public.routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_price_alerts_updated_at 
  BEFORE UPDATE ON public.price_alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
