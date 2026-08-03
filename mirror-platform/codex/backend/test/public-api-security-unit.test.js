import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionConfig } from '../src/middleware/public-api.js';

const CONFIG_NAMES = [
  'NODE_ENV',
  'DATABASE_URL',
  'AUTH_SECRET',
  'RUNTIME_SERVICE_TOKEN',
  'WORDNET_READ_TOKEN',
  'CORS_ORIGINS',
  'CORS_ORIGIN',
  'PUBLIC_SIGNUP_ENABLED',
  'PUBLIC_APP_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM'
];

test('production startup rejects missing or weak public-service configuration', () => {
  withEnvironment({ NODE_ENV: 'production' }, () => {
    assert.throws(() => validateProductionConfig(), /Missing required production configuration/);
  });

  withEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://example.invalid/database',
    AUTH_SECRET: 'short',
    RUNTIME_SERVICE_TOKEN: 'r'.repeat(32),
    WORDNET_READ_TOKEN: 'w'.repeat(32),
    CORS_ORIGINS: 'https://example.com'
  }, () => {
    assert.throws(() => validateProductionConfig(), /AUTH_SECRET must contain at least 32 characters/);
  });
});

test('production startup accepts strong secrets and explicit CORS origins', () => {
  withEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://example.invalid/database',
    AUTH_SECRET: 'a'.repeat(32),
    RUNTIME_SERVICE_TOKEN: 'r'.repeat(32),
    WORDNET_READ_TOKEN: 'w'.repeat(32),
    CORS_ORIGINS: 'https://example.com'
  }, () => assert.doesNotThrow(() => validateProductionConfig()));
});

test('public signup requires complete SMTP configuration in production', () => {
  withEnvironment({
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://example.invalid/database',
    AUTH_SECRET: 'a'.repeat(32),
    RUNTIME_SERVICE_TOKEN: 'r'.repeat(32),
    WORDNET_READ_TOKEN: 'w'.repeat(32),
    CORS_ORIGINS: 'https://example.com',
    PUBLIC_SIGNUP_ENABLED: 'true'
  }, () => assert.throws(() => validateProductionConfig(), /Missing public-signup mail configuration/));
});

function withEnvironment(values, callback) {
  const original = Object.fromEntries(CONFIG_NAMES.map(name => [name, process.env[name]]));
  try {
    for (const name of CONFIG_NAMES) delete process.env[name];
    Object.assign(process.env, values);
    callback();
  } finally {
    for (const name of CONFIG_NAMES) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
}
