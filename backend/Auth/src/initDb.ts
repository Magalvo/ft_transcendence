import db from "./db.js";

async function main() {
  try {
    const exists = await db.schema.hasTable("users");
    if (!exists) {
      await db.schema.createTable("users", (table) => {
        table.uuid("id").primary().notNullable();
        table.string("username").notNullable().unique();
        table.string("passwordHash").nullable(); // Null para OAuth users
        table.string("twoFactorSecret").nullable();
        table.string("tempTwoFactorSecret").nullable();
        table.string("email").nullable();
        table.boolean("online").defaultTo(false);
        table.dateTime("last_request").nullable();
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

    await db.raw("PRAGMA foreign_keys = ON;");
    console.log("Foreign keys enabled!");

    process.exit(0);
  } catch (err) {
    console.error("Error initializing DB:", err);
    process.exit(1);
  }
}

main();
