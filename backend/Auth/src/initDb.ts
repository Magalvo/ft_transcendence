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
        table.string("avatarUrl").nullable();
        table.boolean("online").defaultTo(false);
        table.dateTime("last_request").nullable();
        table.string("resetToken").nullable();
        table.dateTime("resetExpires").nullable();
        table.boolean("accepted_terms").defaultTo(false);
      });
      console.log("Table 'users' created!");

    } else {
      console.log("Table 'users' already exists");
      // Add avatarUrl column if it doesn't exist
      if (!(await db.schema.hasColumn("users", "avatarUrl"))) {
        await db.schema.alterTable("users", (table) => {
          table.string("avatarUrl").nullable();
        });
        console.log("Added avatarUrl column to users table");
      }
      // Add accepted_terms column if it doesn't exist
      if (!(await db.schema.hasColumn("users", "accepted_terms"))) {
        await db.schema.alterTable("users", (table) => {
          table.boolean("accepted_terms").defaultTo(false);
        });
        console.log("Added accepted_terms column to users table");
      }

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

if (!(await db.schema.hasColumn("chat_groups", "owner_id"))) {
  await db.schema.alterTable("chat_groups", (table) => {
    table.uuid("owner_id").nullable().references("id").inTable("users").onDelete("CASCADE");
  });
}
if (!(await db.schema.hasColumn("chat_groups", "visibility"))) {
  await db.schema.alterTable("chat_groups", (table) => {
    table.string("visibility").notNullable().defaultTo("public");
  });
}
if (!(await db.schema.hasColumn("chat_groups", "password_hash"))) {
  await db.schema.alterTable("chat_groups", (table) => {
    table.string("password_hash").nullable();
  });
}
if (!(await db.schema.hasColumn("chat_groups", "created_at"))) {
  await db.schema.alterTable("chat_groups", (table) => {
    table.bigInteger("created_at").notNullable().defaultTo(db.raw("(strftime('%s','now') * 1000)"));
  });
}
await db("chat_groups").whereNull("owner_id").update({ owner_id: db.ref("admin_id") as any });
await db("chat_groups").whereNull("visibility").update({ visibility: "public" });

const chatGroupAdminsExists = await db.schema.hasTable("chat_group_admins");
if (!chatGroupAdminsExists) {
  await db.schema.createTable("chat_group_admins", (table) => {
    table.integer("id_group").notNullable();
    table.uuid("user_id").notNullable();
    table.bigInteger("created_at").notNullable();
    table.primary(["id_group", "user_id"]);
    table.foreign("id_group").references("id_group").inTable("chat_groups").onDelete("CASCADE");
    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
  });
}

const chatGroupBansExists = await db.schema.hasTable("chat_group_bans");
if (!chatGroupBansExists) {
  await db.schema.createTable("chat_group_bans", (table) => {
    table.integer("id_group").notNullable();
    table.uuid("user_id").notNullable();
    table.uuid("banned_by").notNullable();
    table.bigInteger("created_at").notNullable();
    table.primary(["id_group", "user_id"]);
    table.foreign("id_group").references("id_group").inTable("chat_groups").onDelete("CASCADE");
    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
  });
}

const chatGroupMutesExists = await db.schema.hasTable("chat_group_mutes");
if (!chatGroupMutesExists) {
  await db.schema.createTable("chat_group_mutes", (table) => {
    table.integer("id_group").notNullable();
    table.uuid("user_id").notNullable();
    table.uuid("muted_by").notNullable();
    table.bigInteger("expires_at").notNullable();
    table.bigInteger("created_at").notNullable();
    table.primary(["id_group", "user_id"]);
    table.foreign("id_group").references("id_group").inTable("chat_groups").onDelete("CASCADE");
    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
  });
}

const blockedUsersExists = await db.schema.hasTable("blocked_users");
if (!blockedUsersExists) {
  await db.schema.createTable("blocked_users", (table) => {
    table.uuid("blocker_id").notNullable();
    table.uuid("blocked_id").notNullable();
    table.bigInteger("created_at").notNullable();
    table.primary(["blocker_id", "blocked_id"]);
    table.foreign("blocker_id").references("id").inTable("users").onDelete("CASCADE");
    table.foreign("blocked_id").references("id").inTable("users").onDelete("CASCADE");
  });
}

const friendshipsExists = await db.schema.hasTable("friendships");
if (!friendshipsExists) {
  await db.schema.createTable("friendships", (table) => {
    table.uuid("user_a").notNullable();
    table.uuid("user_b").notNullable();
    table.bigInteger("created_at").notNullable().defaultTo(db.raw("(strftime('%s','now') * 1000)"));
    table.primary(["user_a", "user_b"]);
    table.foreign("user_a").references("id").inTable("users").onDelete("CASCADE");
    table.foreign("user_b").references("id").inTable("users").onDelete("CASCADE");
  });
  console.log("Table 'friendships' created!");
} else {
  console.log("Table 'friendships' already exists");
}

const friendRequestsExists = await db.schema.hasTable("friend_requests");
if (!friendRequestsExists) {
  await db.schema.createTable("friend_requests", (table) => {
    table.increments("id").primary();
    table.uuid("requester_id").notNullable();
    table.uuid("target_id").notNullable();
    table.bigInteger("created_at").notNullable().defaultTo(db.raw("(strftime('%s','now') * 1000)"));
    table.unique(["requester_id", "target_id"]);
    table.foreign("requester_id").references("id").inTable("users").onDelete("CASCADE");
    table.foreign("target_id").references("id").inTable("users").onDelete("CASCADE");
  });
  console.log("Table 'friend_requests' created!");
} else {
  console.log("Table 'friend_requests' already exists");
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

const matchesExists = await db.schema.hasTable("matches");

if (!matchesExists) {
  await db.schema.createTable("matches", (table) => {
    table.uuid("id").primary().notNullable();
    table.uuid("team_game_id").nullable();
    table.uuid("player1_id").notNullable();
    table.uuid("player2_id").notNullable();
    table.uuid("winner_id").nullable();
    table.integer("player1_score").notNullable().defaultTo(0);
    table.integer("player2_score").notNullable().defaultTo(0);
    table.string("game_mode").defaultTo("1v1"); // 1v1, tournament, etc
    table.string("status").notNullable().defaultTo("completed"); // completed, abandoned, timeout
    table.timestamp("started_at").notNullable();
    table.timestamp("ended_at").nullable();
    table.integer("duration_seconds").nullable();

    table.foreign("player1_id").references("id").inTable("users").onDelete("CASCADE");
    table.foreign("player2_id").references("id").inTable("users").onDelete("CASCADE");
    table.foreign("winner_id").references("id").inTable("users").onDelete("SET NULL");
  });
  console.log("Table 'matches' created!");
} else {
  console.log("Table 'matches' already exists");
}

if (!(await db.schema.hasColumn("matches", "team_game_id"))) {
  await db.schema.alterTable("matches", (table) => {
    table.uuid("team_game_id").nullable();
  });
}

const playerStatsExists = await db.schema.hasTable("player_stats");

if (!playerStatsExists) {
  await db.schema.createTable("player_stats", (table) => {
    table.uuid("user_id").primary().notNullable();
    table.integer("total_matches").defaultTo(0);
    table.integer("wins").defaultTo(0);
    table.integer("losses").defaultTo(0);
    table.integer("total_goals_scored").defaultTo(0);
    table.integer("total_goals_conceded").defaultTo(0);
    table.decimal("win_percentage", 5, 2).defaultTo(0);
    table.decimal("avg_goals_per_match", 5, 2).defaultTo(0);
    table.integer("current_win_streak").defaultTo(0);
    table.integer("longest_win_streak").defaultTo(0);
    table.timestamp("last_match_at").nullable();
    table.timestamp("updated_at").defaultTo(db.fn.now());

    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
  });
  console.log("Table 'player_stats' created!");
} else {
  console.log("Table 'player_stats' already exists");
  // Add missing columns if needed
  if (!(await db.schema.hasColumn("player_stats", "current_win_streak"))) {
    await db.schema.alterTable("player_stats", (table) => {
      table.integer("current_win_streak").defaultTo(0);
    });
    console.log("Added current_win_streak to player_stats");
  }
}

// Create tournaments table
const tournamentsExists = await db.schema.hasTable("tournaments");

if (!tournamentsExists) {
  await db.schema.createTable("tournaments", (table) => {
    table.uuid("id").primary().notNullable();
    table.string("name").notNullable();
    table.uuid("created_by").notNullable();
    table.string("status").notNullable().defaultTo("active"); // active, completed
    table.uuid("winner_id").nullable();
    table.integer("player_count").notNullable().defaultTo(4);
    table.timestamp("created_at").notNullable();
    table.timestamp("completed_at").nullable();

    table.foreign("created_by").references("id").inTable("users").onDelete("CASCADE");
    table.foreign("winner_id").references("id").inTable("users").onDelete("SET NULL");
  });
  console.log("Table 'tournaments' created!");
} else {
  console.log("Table 'tournaments' already exists");
}

// Create tournament_participants table
const tournamentsParticipantsExists = await db.schema.hasTable("tournament_participants");

if (!tournamentsParticipantsExists) {
  await db.schema.createTable("tournament_participants", (table) => {
    table.increments("id").primary();
    table.uuid("tournament_id").notNullable();
    table.uuid("user_id").notNullable();
    table.boolean("is_eliminated").defaultTo(false);
    table.timestamp("created_at").notNullable();

    table.foreign("tournament_id").references("id").inTable("tournaments").onDelete("CASCADE");
    table.foreign("user_id").references("id").inTable("users").onDelete("CASCADE");
    table.unique(["tournament_id", "user_id"]);
  });
  console.log("Table 'tournament_participants' created!");
} else {
  console.log("Table 'tournament_participants' already exists");
}

// Create tournament_matches table
const tournamentMatchesExists = await db.schema.hasTable("tournament_matches");

if (!tournamentMatchesExists) {
  await db.schema.createTable("tournament_matches", (table) => {
    table.uuid("id").primary().notNullable();
    table.uuid("tournament_id").notNullable();
    table.uuid("game_id").nullable();
    table.integer("round").notNullable();
    table.integer("match_number").notNullable();
    table.uuid("player1_id").notNullable();
    table.uuid("player2_id").notNullable();
    table.uuid("winner_id").nullable();
    table.integer("player1_score").defaultTo(0);
    table.integer("player2_score").defaultTo(0);
    table.string("status").notNullable().defaultTo("pending"); // pending, in_progress, completed
    table.timestamp("created_at").notNullable();
    table.timestamp("completed_at").nullable();

    table.foreign("tournament_id").references("id").inTable("tournaments").onDelete("CASCADE");
    table.foreign("game_id").references("id").inTable("games").onDelete("SET NULL");
    table.foreign("player1_id").references("id").inTable("users").onDelete("CASCADE");
    table.foreign("player2_id").references("id").inTable("users").onDelete("CASCADE");
    table.foreign("winner_id").references("id").inTable("users").onDelete("SET NULL");
  });
  console.log("Table 'tournament_matches' created!");
} else {
  console.log("Table 'tournament_matches' already exists");

  // SQLite cannot alter foreign keys in-place; recreate table when legacy FK still points to matches.
  const fkRaw: any = await db.raw("PRAGMA foreign_key_list('tournament_matches')");
  const fkRows = Array.isArray(fkRaw) ? fkRaw : fkRaw?.[0] ?? [];
  const hasLegacyGameIdFk = fkRows.some(
    (row: any) => String(row?.from) === "game_id" && String(row?.table) === "matches",
  );

  if (hasLegacyGameIdFk) {
    console.log("Migrating tournament_matches.game_id foreign key to reference games table...");
    await db.raw("PRAGMA foreign_keys = OFF;");
    try {
      await db.raw(`
        CREATE TABLE tournament_matches_new (
          id uuid PRIMARY KEY NOT NULL,
          tournament_id uuid NOT NULL,
          game_id uuid NULL,
          round integer NOT NULL,
          match_number integer NOT NULL,
          player1_id uuid NOT NULL,
          player2_id uuid NOT NULL,
          winner_id uuid NULL,
          player1_score integer DEFAULT 0,
          player2_score integer DEFAULT 0,
          status varchar NOT NULL DEFAULT 'pending',
          created_at datetime NOT NULL,
          completed_at datetime NULL,
          FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
          FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
          FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (winner_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      await db.raw(`
        INSERT INTO tournament_matches_new (
          id,
          tournament_id,
          game_id,
          round,
          match_number,
          player1_id,
          player2_id,
          winner_id,
          player1_score,
          player2_score,
          status,
          created_at,
          completed_at
        )
        SELECT
          id,
          tournament_id,
          game_id,
          round,
          match_number,
          player1_id,
          player2_id,
          winner_id,
          player1_score,
          player2_score,
          status,
          created_at,
          completed_at
        FROM tournament_matches
      `);

      await db.raw("DROP TABLE tournament_matches");
      await db.raw("ALTER TABLE tournament_matches_new RENAME TO tournament_matches");
      console.log("Successfully migrated tournament_matches foreign key to games table");
    } finally {
      await db.raw("PRAGMA foreign_keys = ON;");
    }
  }
}

// Create tournament_match_invites table
const tournamentMatchInvitesExists = await db.schema.hasTable("tournament_match_invites");

if (!tournamentMatchInvitesExists) {
  await db.schema.createTable("tournament_match_invites", (table) => {
    table.uuid("id").primary().notNullable();
    table.uuid("tournament_id").notNullable();
    table.uuid("match_id").notNullable();
    table.uuid("to_user_id").notNullable();
    table.uuid("requested_by").notNullable();
    table.string("invite_token").notNullable().unique();
    table.string("status").notNullable().defaultTo("pending"); // pending, accepted, expired
    table.bigInteger("sent_at").notNullable();
    table.bigInteger("expires_at").notNullable();
    table.bigInteger("accepted_at").nullable();

    table.foreign("tournament_id").references("id").inTable("tournaments").onDelete("CASCADE");
    table.foreign("match_id").references("id").inTable("tournament_matches").onDelete("CASCADE");
    table.foreign("to_user_id").references("id").inTable("users").onDelete("CASCADE");
    table.foreign("requested_by").references("id").inTable("users").onDelete("CASCADE");
    table.index(["match_id", "status"]);
    table.index(["to_user_id", "status"]);
  });
  console.log("Table 'tournament_match_invites' created!");
} else {
  console.log("Table 'tournament_match_invites' already exists");
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
