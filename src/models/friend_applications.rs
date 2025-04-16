use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::defaults_for_models::default_to_bigint_zero;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FriendApplications {
    pub sender_id: Uuid,
    pub receiver_id: Uuid,

    #[serde(default = "default_str")]
    pub description: String,
    pub status: String,

    #[serde(default = "default_to_bigint_zero")]
    pub created_at: i64,
}

fn default_str() -> String {
    " ".to_string()
}