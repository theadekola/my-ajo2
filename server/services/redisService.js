import crypto from 'crypto';

const enabled = process.env.REDIS_ENABLED === 'true';
const instanceId = crypto.randomUUID();
let client = null;
let publisher = null;
let subscriber = null;
let status = enabled ? 'disconnected' : 'disabled';
let lastError = null;

const options = () => ({
  socket: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    connectTimeout: 1500,
    reconnectStrategy: retries => Math.min(250 * 2 ** retries, 5000),
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

function observe(connection) {
  connection.on('ready', () => { status = 'ready'; lastError = null; });
  connection.on('reconnecting', () => { status = 'reconnecting'; });
  connection.on('error', error => { status = 'unavailable'; lastError = error?.message || String(error); });
}

export async function connectRedis() {
  if (!enabled) return false;
  try {
    const { createClient } = await import('redis');
    client ||= createClient(options());
    observe(client);
    if (!client.isOpen) await client.connect();
    status = 'ready';
    return true;
  } catch (error) {
    status = 'unavailable'; lastError = error?.message || String(error);
    console.warn(`Redis unavailable; using MSSQL/in-memory fallbacks: ${lastError}`);
    return false;
  }
}

async function usable() {
  if (!enabled) return null;
  if (!client?.isReady) await connectRedis();
  return client?.isReady ? client : null;
}

export async function cacheGet(key) {
  try { const c = await usable(); const value = c ? await c.get(key) : null; return value ? JSON.parse(value) : null; }
  catch { return null; }
}
export async function cacheSet(key, value, ttlSeconds = 30) {
  try { const c = await usable(); if (c) await c.set(key, JSON.stringify(value), { EX:ttlSeconds }); }
  catch { /* cache failure must never fail the request */ }
}
export async function cacheDelete(...keys) {
  try { const c = await usable(); if (c && keys.length) await c.del(keys); }
  catch { /* optional cache */ }
}
export async function cacheDeletePattern(pattern) {
  try {
    const c = await usable(); if (!c) return;
    let cursor = '0';
    do { const result = await c.scan(cursor,{ MATCH:pattern, COUNT:100 }); cursor=String(result.cursor); if(result.keys.length) await c.del(result.keys); } while(cursor!=='0');
  } catch { /* optional cache */ }
}

export async function incrementRateLimit(key, windowMs) {
  try {
    const c = await usable(); if (!c) return null;
    const count = await c.incr(key);
    if (count === 1) await c.pExpire(key, windowMs);
    const ttl = await c.pTTL(key);
    return { count, resetAt:Date.now()+Math.max(ttl,0) };
  } catch { return null; }
}

export async function publishActivity(event) {
  try {
    const c = await usable(); if (!c) return;
    publisher ||= c.duplicate(); observe(publisher); if(!publisher.isOpen) await publisher.connect();
    await publisher.publish('myajo:activity', JSON.stringify({ instanceId, event }));
  } catch { /* local EventEmitter remains available */ }
}

export async function subscribeActivity(listener) {
  if (!enabled) return false;
  try {
    const c = await usable(); if (!c) return false;
    subscriber ||= c.duplicate(); observe(subscriber); if(!subscriber.isOpen) await subscriber.connect();
    await subscriber.subscribe('myajo:activity', message => {
      try { const payload=JSON.parse(message); if(payload.instanceId!==instanceId) listener(payload.event); } catch { /* ignore malformed event */ }
    });
    return true;
  } catch { return false; }
}

export async function redisHealth() {
  const started = Date.now();
  try { const c=await usable(); if(!c) return { enabled, status, fallback:true, error:lastError }; await c.ping(); return { enabled:true,status:'ready',latencyMs:Date.now()-started,fallback:false }; }
  catch(error) { return { enabled,status:'unavailable',fallback:true,error:error?.message || lastError }; }
}
