CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name VARCHAR(80) NOT NULL, phone VARCHAR(24) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role VARCHAR(16) NOT NULL CHECK(role IN ('admin','driver','passenger')),
 car_model VARCHAR(80), plate_number VARCHAR(24),
 is_online BOOLEAN NOT NULL DEFAULT FALSE,
 driver_rating NUMERIC(6,1) NOT NULL DEFAULT 50,
 driver_rejection_count INTEGER NOT NULL DEFAULT 0,
 driver_completion_count INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS driver_locations (
 driver_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 lat DOUBLE PRECISION NOT NULL CHECK(lat BETWEEN -90 AND 90),
 lng DOUBLE PRECISION NOT NULL CHECK(lng BETWEEN -180 AND 180),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 passenger_id UUID REFERENCES users(id),
 passenger_name VARCHAR(80), passenger_phone VARCHAR(24),
 driver_id UUID REFERENCES users(id),
 pickup_address VARCHAR(240) NOT NULL, destination_address VARCHAR(240) NOT NULL,
 pickup_lat DOUBLE PRECISION NOT NULL, pickup_lng DOUBLE PRECISION NOT NULL,
 dest_lat DOUBLE PRECISION NOT NULL, dest_lng DOUBLE PRECISION NOT NULL,
 note VARCHAR(500),
 trip_distance_m DOUBLE PRECISION NOT NULL DEFAULT 0,
 meter_fare NUMERIC(12,2) NOT NULL DEFAULT 400,
 meter_last_lat DOUBLE PRECISION,
 meter_last_lng DOUBLE PRECISION,
 status VARCHAR(20) NOT NULL DEFAULT 'searching'
 CHECK(status IN ('searching','accepted','arrived','started','completed','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), accepted_at TIMESTAMPTZ,
 started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trip_distance_m DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS meter_fare NUMERIC(12,2) NOT NULL DEFAULT 400;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS meter_last_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS meter_last_lng DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_driver_created_idx ON orders(driver_id,created_at DESC);


-- Driver onboarding and dispatcher approval
ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_license_number VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_rating NUMERIC(6,1) NOT NULL DEFAULT 50;
ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_rejection_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_completion_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(16) NOT NULL DEFAULT 'approved';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_approval_status_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_approval_status_check CHECK (approval_status IN ('pending','approved','rejected'));
  END IF;
END $$;


-- Sequential dispatcher offer queue
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_status VARCHAR(16) NOT NULL DEFAULT 'idle';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offered_driver_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS offer_expires_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tried_driver_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_attempts INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS orders_dispatch_queue_idx ON orders(dispatch_enabled,status,created_at) WHERE dispatch_enabled=TRUE;

ALTER TABLE orders ALTER COLUMN passenger_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS passenger_name VARCHAR(80);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS passenger_phone VARCHAR(24);


-- Driver wallet balance and immutable top-up ledger
ALTER TABLE users ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS driver_balance_transactions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 admin_id UUID NOT NULL REFERENCES users(id),
 amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
 note VARCHAR(240),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS driver_balance_transactions_driver_created_idx
 ON driver_balance_transactions(driver_id,created_at DESC);


-- Dispatcher-controlled order priority: urgent orders dispatch first
ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority VARCHAR(12) NOT NULL DEFAULT 'normal';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_priority_check') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_priority_check CHECK (priority IN ('normal','urgent'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS orders_priority_dispatch_idx ON orders(priority,created_at) WHERE status='searching' AND dispatch_enabled=TRUE;


-- Daily driver vehicle safety inspections visible to dispatchers
CREATE TABLE IF NOT EXISTS driver_vehicle_checks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 checks JSONB NOT NULL,
 note VARCHAR(500),
 status VARCHAR(16) NOT NULL CHECK(status IN ('passed','attention')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS driver_vehicle_checks_driver_created_idx
 ON driver_vehicle_checks(driver_id,created_at DESC);
