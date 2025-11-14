import db from "./db.js";
import { v4 as uuidv4 } from "uuid";

async function main() {
  try {
    const exists = await db.schema.hasTable("users");
    if (!exists) {
      await db.schema.createTable("users", (table) => {
        table.uuid("id").primary().defaultTo(uuidv4());
        table.string("username").notNullable().unique();
        table.string("passwordHash").nullable(); // Null para OAuth users
        table.string("twoFactorSecret").nullable();
        table.string("tempTwoFactorSecret").nullable();
        table.string("email").nullable();
        table.boolean("online").defaultTo(false);
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
        table.string("token").notNullable();
        table.dateTime("expires_at").notNullable();
      });
      console.log("Table 'refresh_tokens' created!");
    }

    process.exit(0);
  } catch (err) {
    console.error("Error initializing DB:", err);
    process.exit(1);
  }
}

main();
