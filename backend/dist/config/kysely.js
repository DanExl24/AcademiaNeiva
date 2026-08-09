"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const kysely_1 = require("kysely");
const db_1 = require("./db");
exports.db = new kysely_1.Kysely({
    dialect: new kysely_1.PostgresDialect({ pool: db_1.pool }),
});
