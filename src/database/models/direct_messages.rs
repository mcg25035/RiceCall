use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct DirectMessages {
    pub direct_message_id: Uuid,

    #[serde(default = "default_str")]
    pub content: String,

    #[serde(default = "default_type")]
    pub r#type: String,

    pub sender_id: Uuid,
    pub user1_id: Uuid,
    pub user2_id: Uuid,

    #[serde(default = "default_to_0")]
    pub timestamp: i64,
}

fn default_to_0() -> i64 {
    0
}

fn default_type() -> String {
    "dm".to_string()
}

fn default_str() -> String {
    " ".to_string()
}