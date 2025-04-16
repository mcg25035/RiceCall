use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::defaults_for_models::{
    default_str,
    default_to_bigint_zero,
};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Messages {
    pub message_id: Uuid,

    #[serde(default = "default_str")]
    pub content: String,

    #[serde(default = "default_type")]
    pub r#type: String,

    pub sender_id: Uuid,
    pub server_id: Uuid,
    pub channel_id: Uuid,

    #[serde(default = "default_to_bigint_zero")]
    pub created_at: i64,
}

fn default_type() -> String {
    return "general".to_string();
}