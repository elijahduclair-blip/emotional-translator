import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`?? Created backup directory: ${BACKUP_DIR}`);
}

export function backupDatabase() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);
    
    // Parse connection string
    const url = new URL(dbUrl);
    const dbName = url.pathname.slice(1);
    const user = url.username;
    const host = url.hostname;
    const port = url.port || 5432;
    const password = url.password;

    const pgDump = process.env.PG_DUMP_PATH || 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe';
    const args = [];
    if (user) args.push('-U', user);
    if (host) args.push('-h', host);
    if (port) args.push('-p', String(port));
    args.push('-f', backupFile, dbName);

    // Set password environment variable if present
    const env = { ...process.env };
    if (password) {
      env.PGPASSWORD = password;
    }

    console.log(`? Creating backup: ${backupFile}`);
    execFileSync(pgDump, args, { env, stdio: 'pipe' });

    const stats = fs.statSync(backupFile);
    console.log(`? Backup created: ${stats.size} bytes`);
    
    return { success: true, file: backupFile, size: stats.size };
  } catch (error) {
    console.error(`? Backup failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export function listBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-'))
      .sort()
      .reverse();
    
    return files.map(f => ({
      name: f,
      path: path.join(BACKUP_DIR, f),
      size: fs.statSync(path.join(BACKUP_DIR, f)).size,
      date: fs.statSync(path.join(BACKUP_DIR, f)).mtime
    }));
  } catch (error) {
    console.error('Failed to list backups:', error);
    return [];
  }
}

export function restoreDatabase(backupFile) {
  try {
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error('DATABASE_URL not set');

    // Parse connection string
    const url = new URL(dbUrl);
    const dbName = url.pathname.slice(1);
    const user = url.username;
    const host = url.hostname;
    const port = url.port || 5432;
    const password = url.password;

    console.log(`? Restoring from: ${backupFile}`);

    const psql = process.env.PSQL_PATH || 'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe';
    const args = [];
    if (user) args.push('-U', user);
    if (host) args.push('-h', host);
    if (port) args.push('-p', String(port));
    args.push('-d', dbName, '-f', backupFile);

    const env = { ...process.env };
    if (password) {
      env.PGPASSWORD = password;
    }

    execFileSync(psql, args, { env, stdio: 'pipe' });
    console.log(`? Restore complete`);
    
    return { success: true };
  } catch (error) {
    console.error(`? Restore failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// CLI usage
if (process.argv[2] === 'backup') {
  const result = backupDatabase();
  if (!result.success) process.exitCode = 1;
} else if (process.argv[2] === 'list') {
  const backups = listBackups();
  console.log('\n?? Available backups:');
  backups.forEach((b, i) => {
    console.log(`  ${i + 1}. ${b.name} (${(b.size / 1024).toFixed(2)}KB) - ${b.date.toLocaleString()}`);
  });
} else if (process.argv[2] === 'restore' && process.argv[3]) {
  const result = restoreDatabase(process.argv[3]);
  if (!result.success) process.exitCode = 1;
} else {
  console.log('Usage:');
  console.log('  npm run backup           - Create a backup');
  console.log('  npm run backup:list      - List available backups');
  console.log('  npm run backup:restore <file> - Restore from backup');
}
