// src/services/chat.ts
import db from '../db.js';

export async function getGroups() {
  console.log('getGroups called');
  try {
    const rows = await db('chat_groups').select('*');
    console.log('getGroups result:', rows);
    return rows;
  } catch (err) {
    console.error('DB ERROR in getGroups:', err);
    throw err;
  }
}


export async function getGroupMessages(groupId: number, limit = 50) {
  return db('chat_group_messages as m')
    .join('users as u', 'u.id', 'm.id_usersender')
    .select(
      'm.id_message',
      'm.id_usersender',
      db.raw('u.username as sender_name'),
      'm.messagem',
      'm.timestamp'
    )
    .where('m.id_group', groupId)
    .orderBy('m.timestamp', 'desc')
    .limit(limit);
}

export async function createGroupMessage(
  groupId: number,
  userId: number,
  content: string
) {
  const timestamp = Date.now();

  await db('chat_group_messages').insert({
    id_group: groupId,
    id_usersender: userId,
    messagem: content,
    timestamp: timestamp,
  });

  return {
    id_message: `msg_${timestamp}`,
    id_group: groupId,
    id_usersender: userId,
    messagem: content,
    timestamp,
  };
}
