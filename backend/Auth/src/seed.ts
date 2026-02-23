import db from './db.js';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  const userId = uuidv4();

  await db('users').insert({
    id: userId,
    username: 'Alice',
    passwordHash: null,
    email: 'alice@example.com',
  });

  await db('chat_groups').insert({
    admin_id: userId,
    name: 'General',
  });

  console.log('Seeded DB!');
  process.exit(0);
}

seed();
