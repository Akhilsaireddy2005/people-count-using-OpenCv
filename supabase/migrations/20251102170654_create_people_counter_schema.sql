/*
  # People Counter AI - Database Schema

  ## Overview
  Complete database schema for AI-powered people counting system with real-time
  tracking, analytics, and alert management.

  ## New Tables

  ### 1. cameras
  Stores camera feed configuration and metadata
  - `id` (uuid, primary key) - Unique camera identifier
  - `name` (text) - Camera display name
  - `location` (text) - Physical location description
  - `stream_url` (text) - Camera stream URL (optional for local webcam)
  - `is_active` (boolean) - Whether camera is currently active
  - `created_by` (uuid) - User who created the camera
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. count_logs
  Stores real-time people counting data from all cameras
  - `id` (uuid, primary key) - Unique log entry
  - `camera_id` (uuid, foreign key) - Reference to cameras table
  - `timestamp` (timestamptz) - When count was recorded
  - `count_in` (integer) - Number of people entering
  - `count_out` (integer) - Number of people exiting
  - `total_count` (integer) - Current total people in area
  - `detection_data` (jsonb) - Raw detection coordinates and metadata
  - `created_at` (timestamptz) - Record creation time

  ### 3. settings
  Stores threshold limits and alert configuration per camera
  - `id` (uuid, primary key) - Unique setting identifier
  - `camera_id` (uuid, foreign key) - Reference to cameras table
  - `threshold_limit` (integer) - Maximum allowed people count
  - `alert_enabled` (boolean) - Whether alerts are enabled
  - `alert_email` (text) - Email for alert notifications
  - `alert_sound` (boolean) - Enable sound alerts
  - `updated_by` (uuid) - User who last updated settings
  - `updated_at` (timestamptz) - Last update timestamp

  ### 4. alerts
  Logs all threshold violation alerts
  - `id` (uuid, primary key) - Unique alert identifier
  - `camera_id` (uuid, foreign key) - Reference to cameras table
  - `triggered_at` (timestamptz) - When alert was triggered
  - `count_value` (integer) - People count that triggered alert
  - `threshold_value` (integer) - Threshold that was exceeded
  - `acknowledged` (boolean) - Whether alert was acknowledged
  - `acknowledged_by` (uuid) - User who acknowledged alert
  - `acknowledged_at` (timestamptz) - When alert was acknowledged

  ## Security
  - Enable RLS on all tables
  - Authenticated users can read all data
  - Only authenticated users can insert/update data
  - Users can only modify records they created (where applicable)
*/

-- Create cameras table
CREATE TABLE IF NOT EXISTS cameras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL,
  stream_url text,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create count_logs table
CREATE TABLE IF NOT EXISTS count_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id uuid REFERENCES cameras(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  count_in integer DEFAULT 0,
  count_out integer DEFAULT 0,
  total_count integer DEFAULT 0,
  detection_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id uuid REFERENCES cameras(id) ON DELETE CASCADE UNIQUE,
  threshold_limit integer DEFAULT 50,
  alert_enabled boolean DEFAULT true,
  alert_email text,
  alert_sound boolean DEFAULT true,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  camera_id uuid REFERENCES cameras(id) ON DELETE CASCADE,
  triggered_at timestamptz DEFAULT now(),
  count_value integer NOT NULL,
  threshold_value integer NOT NULL,
  acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for cameras table
CREATE POLICY "Authenticated users can view all cameras"
  ON cameras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert cameras"
  ON cameras FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own cameras"
  ON cameras FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own cameras"
  ON cameras FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for count_logs table
CREATE POLICY "Authenticated users can view all logs"
  ON count_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert logs"
  ON count_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update logs"
  ON count_logs FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete logs"
  ON count_logs FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for settings table
CREATE POLICY "Authenticated users can view all settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert settings"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete settings"
  ON settings FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for alerts table
CREATE POLICY "Authenticated users can view all alerts"
  ON alerts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert alerts"
  ON alerts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update alerts"
  ON alerts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete alerts"
  ON alerts FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_count_logs_camera_id ON count_logs(camera_id);
CREATE INDEX IF NOT EXISTS idx_count_logs_timestamp ON count_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_camera_id ON alerts(camera_id);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_camera_id ON settings(camera_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_cameras_updated_at ON cameras;
CREATE TRIGGER update_cameras_updated_at
  BEFORE UPDATE ON cameras
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();