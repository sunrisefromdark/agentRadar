import type { DbClient } from "./client.ts";
import { databaseDbClient } from "./client.ts";

function userPreferencesMigrationSql(db: DbClient): string {
  if (db.dialect === "postgres") {
    return `
      create table if not exists user_preferences (
        user_id text primary key,
        interest_topics_json jsonb not null default '[]'::jsonb,
        ui_lang text,
        ui_theme text,
        created_at timestamptz not null,
        updated_at timestamptz not null
      )
    `;
  }

  return `
    create table if not exists user_preferences (
      user_id varchar(191) primary key,
      interest_topics_json text not null,
      ui_lang varchar(64),
      ui_theme varchar(64),
      created_at varchar(40) not null,
      updated_at varchar(40) not null
    )
  `;
}

function userTrackedReposMigrationSql(db: DbClient): string {
  if (db.dialect === "postgres") {
    return `
      create table if not exists user_tracked_repos (
        user_id text not null,
        repo_full_name text not null,
        repo_url text not null,
        source text not null,
        created_at timestamptz not null,
        updated_at timestamptz not null,
        primary key (user_id, repo_full_name)
      )
    `;
  }

  return `
    create table if not exists user_tracked_repos (
      user_id varchar(191) not null,
      repo_full_name varchar(255) not null,
      repo_url text not null,
      source varchar(32) not null,
      created_at varchar(40) not null,
      updated_at varchar(40) not null,
      primary key (user_id, repo_full_name)
    )
  `;
}

export async function runAppMigrations(db: DbClient = databaseDbClient): Promise<void> {
  await db.query(userPreferencesMigrationSql(db));
  await db.query(userTrackedReposMigrationSql(db));
}
