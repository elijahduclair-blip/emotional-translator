import { createSchema } from './schema.js';

async function migrate() {
  try {
    console.log('?? Running migrations...');
    await createSchema();
    console.log('? Core schema created');

    console.log('? All migrations complete');
    process.exit(0);
  } catch (error) {
    console.error('? Migration failed:', error);
    process.exit(1);
  }
}

migrate();
