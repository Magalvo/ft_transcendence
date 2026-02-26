import db from "./db.js";

async function main() {
  try {
    const exists = await db.schema.hasTable("users");
    if (!exists) {
      await db.schema.createTable("users", (table) => {
        table.uuid("id").primary().notNullable();
        table.string("username").notNullable().unique();
        table.string("passwordHash").nullable();
        table.string("twoFactorSecret").nullable();
        table.string("tempTwoFactorSecret").nullable();
        table.string("email").nullable();
        table.boolean("online").defaultTo(false);
        table.dateTime("last_request").nullable();
        table.string("resetToken").nullable();
        table.dateTime("resetExpires").nullable();

      });
      console.log("Table 'users' created!");
      
    } else {
      console.log("Table 'users' already exists");
    }

  const refreshExists = await db.schema.hasTable("refresh_tokens");

  if (!refreshExists) {
    await db.schema.createTable("refresh_tokens", (table) => {
      table.increments("id").primary();
      table.string("username").notNullable();
      table.uuid("userId").notNullable();
      table.foreign("userId").references("id").inTable("users").onDelete("CASCADE");
      table.string("token").notNullable();
      table.dateTime("expires_at").notNullable();
      table.dateTime("last_update").notNullable();
    });
    console.log("Table 'refresh_tokens' created!");
  }
  else {
    console.log("Table 'refresh_tokens' already exists");
  }

  const chatGroupsExists = await db.schema.hasTable("chat_groups");

if (!chatGroupsExists) {
  await db.schema.createTable("chat_groups", (table) => {
    table.increments("id_group").primary();
    table.uuid("admin_id").notNullable();
    table.string("name").notNullable();

    table
      .foreign("admin_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
  });

  console.log("Table 'chat_groups' created!");
} else {
  console.log("Table 'chat_groups' already exists");
}

const chatGroupMembersExists = await db.schema.hasTable("chat_group_members");

if (!chatGroupMembersExists) {
  await db.schema.createTable("chat_group_members", (table) => {
    table.integer("id_group").notNullable();
    table.uuid("user_id").notNullable();

    table.primary(["id_group", "user_id"]);

    table
      .foreign("id_group")
      .references("id_group")
      .inTable("chat_groups")
      .onDelete("CASCADE");

    table
      .foreign("user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
  });

  console.log("Table 'chat_group_members' created!");
} else {
  console.log("Table 'chat_group_members' already exists");
}

const chatGroupMessagesExists = await db.schema.hasTable("chat_group_messages");

if (!chatGroupMessagesExists) {
  await db.schema.createTable("chat_group_messages", (table) => {
    table.increments("id_message").primary();
    table.integer("id_group").notNullable();
    table.uuid("id_usersender").notNullable();
    table.text("messagem").notNullable();
    table.bigInteger("timestamp").notNullable();

    table
      .foreign("id_group")
      .references("id_group")
      .inTable("chat_groups")
      .onDelete("CASCADE");

    table
      .foreign("id_usersender")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
  });

  console.log("Table 'chat_group_messages' created!");
} else {
  console.log("Table 'chat_group_messages' already exists");
}

const privateChatsExists = await db.schema.hasTable("private_chats");

if (!privateChatsExists) {
  await db.schema.createTable("private_chats", (table) => {
    table.increments("id_privatechat").primary();
    table.uuid("id_user1").notNullable();
    table.uuid("id_user2").notNullable();

    table
      .foreign("id_user1")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    table
      .foreign("id_user2")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");

    table.unique(["id_user1", "id_user2"]);
  });

  console.log("Table 'private_chats' created!");
} else {
  console.log("Table 'private_chats' already exists");
}

const privateMessagesExists = await db.schema.hasTable("private_messages");

if (!privateMessagesExists) {
  await db.schema.createTable("private_messages", (table) => {
    table.increments("id_message").primary();
    table.integer("id_privatechat").notNullable();
    table.uuid("id_usersender").notNullable();
    table.text("messagem").notNullable();
    table.bigInteger("timestamp").notNullable();

    table
      .foreign("id_privatechat")
      .references("id_privatechat")
      .inTable("private_chats")
      .onDelete("CASCADE");

    table
      .foreign("id_usersender")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
  });

  console.log("Table 'private_messages' created!");
} else {
  console.log("Table 'private_messages' already exists");
}

const gamesExists = await db.schema.hasTable("games");

  if (!gamesExists) {
    await db.schema.createTable("games", (table) => {
      table.uuid("id").primary().notNullable();
      table.string("duration").notNullable(); // fast | normal | long
      table.boolean("powerups").notNullable();
      table.string("mode").notNullable(); // 1v1 | 2v2 | 3v3
      table.integer("team_a_score").notNullable();
      table.integer("team_b_score").notNullable();
      table.string("winner").notNullable(); // A | B
      table.timestamp("created_at").defaultTo(db.fn.now());
  });
  console.log("Table 'games' created!");
}
else {
  console.log("Table 'games' already exists");
} 

const gamePlayersExists = await db.schema.hasTable("game_players");

if (!gamePlayersExists) {
  await db.schema.createTable("game_players", (table) => {
    table.uuid("game_id").notNullable();
    table.uuid("user_id").notNullable();
    table.string("team").notNullable(); // A | B

    table.primary(["game_id", "user_id"]);

    table
      .foreign("game_id")
      .references("id")
      .inTable("games")
      .onDelete("CASCADE");

    table
      .foreign("user_id")
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
  });
  console.log("Table 'game_players' created!");
}
else {
  console.log("Table 'game_players' already exists");
}

  await db.raw("PRAGMA foreign_keys = ON;");
  console.log("Foreign keys enabled!");

  process.exit(0);
  } catch (err) {
    console.error("Error initializing DB:", err);
    process.exit(1);
  }
}

main();
