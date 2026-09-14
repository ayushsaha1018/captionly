-- Neon Local's HTTP proxy (ghcr.io/timowilhelm/local-neon-http-proxy) authenticates
-- against a "mock control plane" that looks up the connecting hostname in this table.
-- Vanilla postgres images don't have it, so the proxy's auth check fails with
-- `relation "neon_control_plane.endpoints" does not exist` unless we seed it here.
CREATE SCHEMA IF NOT EXISTS neon_control_plane;

CREATE TABLE IF NOT EXISTS neon_control_plane.endpoints (
  endpoint_id VARCHAR(255) PRIMARY KEY,
  allowed_ips VARCHAR(255)
);

-- allowed_ips must be a valid CIDR/IP pattern (not NULL, not empty) or the proxy
-- panics parsing it; '0.0.0.0/0' means "allow any client IP".
INSERT INTO neon_control_plane.endpoints (endpoint_id, allowed_ips)
VALUES ('localhost', '0.0.0.0/0')
ON CONFLICT DO NOTHING;
