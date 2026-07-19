'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createMySqlPool } = require('../src/hub/repository');
const { loadDotEnv, projectRoot } = require('../src/shared/config');

function migrationFiles(directory = path.join(projectRoot(), 'migrations')) {
  return fs.readdirSync(directory)
    .filter((file) => /^\d+_.+\.sql$/i.test(file))
    .sort((a, b) => a.localeCompare(b));
}

function statements(sql) {
  return String(sql).split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
}

async function runMigrations(pool, directory) {
  const connection = await pool.getConnection();
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [appliedRows] = await connection.query('SELECT name FROM schema_migrations');
    const applied = new Set(appliedRows.map((row) => row.name));
    for (const file of migrationFiles(directory)) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(directory || path.join(projectRoot(), 'migrations'), file), 'utf8');
      await connection.beginTransaction();
      try {
        for (const statement of statements(sql)) await connection.query(statement);
        await connection.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw new Error(`Migration ${file} failed: ${error.message}`, { cause: error });
      }
    }
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  loadDotEnv();
  const pool = createMySqlPool();
  runMigrations(pool)
    .then(() => { console.log('Migrations complete.'); })
    .finally(() => pool.end())
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { migrationFiles, runMigrations, statements };
