use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::defaults_for_models::{
    default_str,
    default_to_bigint_zero,
};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct MemberApplications {
    pub user_id: Uuid,
    pub server_id: Uuid,

    #[serde(default = "default_str")]
    pub description: String,

    #[serde(default = "default_to_bigint_zero")]
    pub created_at: i64,
}