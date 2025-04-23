use std::env;
use sqlx::Pool;
use sqlx::mysql::{MySql, MySqlPool, MySqlConnectOptions, MySqlPoolOptions};

pub type DBPool = Pool<MySql>;

pub async fn create_pool() -> Result<MySqlPool, sqlx::Error> {
    let conn_opts = MySqlConnectOptions::new()
        .host(&env::var("DB_HOST").unwrap_or_else(|_| "localhost".to_string()))
        .port(env::var("DB_PORT").unwrap_or_else(|_| "3306".to_string()).parse().unwrap())
        .username(&env::var("DB_USER").unwrap_or_else(|_| "root".to_string()))
        .password(&env::var("DB_PASSWORD").unwrap_or_else(|_| "password".to_string()))
        .database(&env::var("DB_NAME").unwrap_or_else(|_| "chat_app".to_string()))
        .charset("utf8mb4_unicode_ci");
    
    let pool = MySqlPoolOptions::new()
    .max_connections(10)
    .connect_with(conn_opts)
    .await?;
    
    return pool;
}