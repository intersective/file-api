import redis from 'redis';
import { promisify } from 'util';
import unserialize from 'locutus/php/var/unserialize';
import serialize from 'locutus/php/var/serialize';

import { Log } from '../utils';

// we are using db 1 for core and db 0 for resque in Redis
const redisClient = redis.createClient({ host: process.env.REDIS_HOST, db: process.env.REDIS_DB });
const getAsync = promisify(redisClient.get).bind(redisClient);

redisClient.on('ready', () => {
  console.log('Redis is ready.');
});
redisClient.on('error', (e: any) => {
  console.error('Error in Redis.', e);
});

export const readCache = async (cacheKey: string) => {
  const data = await getAsync(cacheKey);
  if (data) {
    Log.info('Cache exists', { cacheKey, data });
    // since we are serializing the cache data in PHP, we need to unserialize it here as well
    const result = unserialize(data);
    if (result) {
      Log.info('Returning cached result', { cacheKey, result });
      return result;
    }
  }
  Log.info('Cache not exists', { cacheKey });
  return null;
}

export const writeCache = (cacheKey: string, data: any) => {
  redisClient.set(cacheKey, serialize(data));
  // if expire time set up, set expire time, otherwise don't expire
  if (process.env.CACHE_EXPIRE_TIME) {
    redisClient.expire(cacheKey, +process.env.CACHE_EXPIRE_TIME);
  }
  return true;
}
