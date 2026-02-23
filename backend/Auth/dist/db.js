"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var knex_1 = require("knex");
var path_1 = require("path");
var url_1 = require("url");
var dotenv_1 = require("dotenv");
var path_2 = require("path");
dotenv_1.default.config({ path: path_2.default.resolve(process.cwd(), '.env') });
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = (0, path_1.dirname)(__filename);
var dbFile = process.env.DB_FILE || (0, path_1.join)(__dirname, "dev.sqlite");
console.log("Using DB file:", dbFile);
var db = (0, knex_1.default)({
    client: "sqlite3",
    connection: { filename: dbFile },
    useNullAsDefault: true,
});
exports.default = db;
