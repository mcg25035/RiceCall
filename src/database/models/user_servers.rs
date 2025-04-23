use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::defaults_for_models::{
    default_to_false,
    default_to_bigint_zero,
};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UserServers {
    pub user_id: Uuid,
    pub server_id: Uuid,

    #[serde(default = "default_to_false")]
    pub owned: bool,

    #[serde(default = "default_to_false")]
    pub recent: bool,

    #[serde(default = "default_to_false")]
    pub favorite: bool,

    #[serde(default = "default_to_bigint_zero")]
    pub timestamp: i64,
}