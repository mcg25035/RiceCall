use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::defaults_for_models::{
    default_str,
    default_to_zero,
    default_to_false,
    default_to_bigint_zero,
};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Members {
    pub user_id: Uuid,
    pub server_id: Uuid,

    #[serde(default = "default_str")]
    pub nickname: String,

    #[serde(default = "default_to_zero")]
    pub contribution: u32,

    #[serde(default = "default_to_bigint_zero")]
    pub last_message_time: i64,

    #[serde(default = "default_to_bigint_zero")]
    pub last_join_channel_time: i64,

    #[serde(default = "default_to_zero")]
    pub permission_level: u32,

    #[serde(default = "default_to_false")]
    pub is_blocked: bool,

    #[serde(default = "default_to_bigint_zero")]
    pub created_at: i64,
}