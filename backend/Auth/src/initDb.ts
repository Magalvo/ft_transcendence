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
