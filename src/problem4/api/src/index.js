const express = require("express");
const { Pool } = require("pg");
const Redis = require("ioredis");

const app = express();

// Enhanced database configuration
const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "postgres",
  port: process.env.DB_PORT || 5432,
  max: 10, // Maximum connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Enhanced Redis configuration with retry strategy
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: process.env.REDIS_PORT || 6379,
  retryDelayOnFailover: 100,
  enableReadyCheck: true,
  lazyConnect: true,
  connecting: 5000,
  retryDelayOnFailover: 100,
  enableAutoRefreshTimeout: true,
  maxRetriesPerRequest: 3,
});

// Redis error handling
redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Redis connected successfully');
});

// Database error handling
pool.on('error', (err) => {
  console.error('Postgres pool error:', err);
});

app.get("/api/users", async (req, res) => {
  let client = null;
  try {
    // Test database connection
    client = await pool.connect();
    const result = await client.query("SELECT NOW() as current_time");
    
    // Test Redis connection
    await redis.set("last_call", Date.now());
    const lastCall = await redis.get("last_call");
    
    res.json({ 
      ok: true, 
      time: result.rows[0].current_time,
      last_call: lastCall,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ 
      ok: false, 
      error: err.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

app.get("/status", async (req, res) => {
  const status = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || "development"
  };

  // Check database connectivity
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    status.database = "connected";
  } catch (err) {
    status.database = "disconnected";
    status.database_error = err.message;
  }

  // Check Redis connectivity
  try {
    await redis.ping();
    status.redis = "connected";
  } catch (err) {
    status.redis = "disconnected";
    status.redis_error = err.message;
  }

  // Return appropriate status code
  const isHealthy = status.database === "connected" && status.redis === "connected";
  res.status(isHealthy ? 200 : 503).json(status);
});

// Health check endpoint for container health checks
app.get("/health", async (req, res) => {
  try {
    // Quick health check without detailed info
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await redis.ping();
    res.status(200).send('OK');
  } catch (err) {
    res.status(503).send('Service Unavailable');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Gracefully shutting down...');
  try {
    await pool.end();
    redis.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('Gracefully shutting down...');
  try {
    await pool.end();
    redis.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
