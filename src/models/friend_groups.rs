use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::defaults_for_models::{
    default_str,
    default_to_zero,
    default_to_bigint_zero,
};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct FriendGroups {
    pub friend_group_id: Uuid,
    #[serde(default = "default_str")]
    pub name: String,

    #[serde(default = "default_to_zero")]
    pub order: u32,
    pub user_id: Uuid,

    #[serde(default = "default_to_bigint_zero")]
    pub created_at: i64,
}