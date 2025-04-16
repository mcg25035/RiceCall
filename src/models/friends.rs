use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Friends {
    pub user_id: Uuid,
    pub target_id: Uuid,

    #[serde(default = "default_to_false")]
    pub is_blocked: bool,

    pub friend_group_id: Uuid,

    #[serde(default = "default_to_zero")]
    pub created_at: i64,
}

fn default_to_zero() -> i64 {
    0
}

fn default_to_false() -> bool {
    false
}