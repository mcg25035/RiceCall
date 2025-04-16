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
pub struct Servers {
    pub server_id: Uuid,

    #[serde(default = "default_str")]
    pub name: String,

    #[serde(default = "default_str")]
    pub avatar: String,

    #[serde(default = "default_str")]
    pub avatar_url: String,

    #[serde(default = "default_str")]
    pub announcement: String,

    #[serde(default = "default_str")]
    pub apply_notice: String,

    #[serde(default = "default_str")]
    pub description: String,

    #[serde(default = "default_str")]
    pub display_id: String,

    #[serde(default = "default_str")]
    pub slogan: String,

    #[serde(default = "default_to_zero")]
    pub level: u32,

    #[serde(default = "default_to_zero")]
    pub wealth: u32,

    #[serde(default = "default_to_false")]
    pub receive_apply: bool,

    #[serde(default = "default_to_false")]
    pub allow_direct_message: bool,

    #[serde(default = "default_type")]
    pub r#type: String,

    #[serde(default = "default_visibility")]
    pub visibility: String,

    pub lobby_id: Uuid,
    pub owner_id: Uuid,

    #[serde(default = "default_to_bigint_zero")]
    pub created_at: i64,
}

fn default_type() -> String {
    return "game".to_string();
}

fn default_visibility() -> String {
    return "public".to_string();
}