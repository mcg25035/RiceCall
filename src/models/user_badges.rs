use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::defaults_for_models::{
    default_to_zero,
    default_to_bigint_zero,
};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserBadges {
    pub user_id: Uuid,
    pub badge_id: Uuid,

    #[serde(default = "default_to_zero")]
    pub order: u32,

    #[serde(default = "default_to_bigint_zero")]
    pub created_at: i64,
}