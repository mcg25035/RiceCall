use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Accounts {
    pub account: String,
    pub password: String,
    pub user_id: Uuid
}