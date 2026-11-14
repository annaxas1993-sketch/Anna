CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name VARCHAR(80) NOT NULL, phone VARCHAR(24) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role VARCHAR(16) NOT NULL CHECK(role IN ('admin','driver','passenger')),
 car_model VARCHAR(80), plate_number VARCHAR(24),
 is_online BOOLEAN NOT NULL DEFAULT FALSE,
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
 passenger_id UUID NOT NULL REFERENCES users(id),
 driver_id UUID REFERENCES users(id),
 pickup_address VARCHAR(240) NOT NULL, destination_address VARCHAR(240) NOT NULL,
 pickup_lat DOUBLE PRECISION NOT NULL, pickup_lng DOUBLE PRECISION NOT NULL,
 dest_lat DOUBLE PRECISION NOT NULL, dest_lng DOUBLE PRECISION NOT NULL,
 note VARCHAR(500),
 status VARCHAR(20) NOT NULL DEFAULT 'searching'
 CHECK(status IN ('searching','accepted','arrived','started','completed','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), accepted_at TIMESTAMPTZ,
 started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_status_created_idx ON orders(status,created_at DESC);
CREATE INDEX IF NOT EXISTS orders_driver_created_idx ON orders(driver_id,created_at DESC);
