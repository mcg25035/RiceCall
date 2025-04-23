use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::defaults_for_models::*;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Channels {
    pub channel_id: Uuid,
    pub name: String,
    pub password: String,

    #[serde(default = "default_to_zero")]
    pub order: u32,
    pub bitrate: u32,

    #[serde(default = "default_to_zero")]
    pub user_limit: u32,

    #[serde(default = "default_to_zero")]
    pub guest_text_wait_time: u32,

    #[serde(default = "default_to_zero")]
    pub guest_text_max_length: u32,

    #[serde(default = "default_to_false")]
    pub is_lobby: bool,

    #[serde(default = "default_to_false")]
    pub slowmode: bool,

    #[serde(default = "default_to_false")]
    pub forbid_text: bool,

    #[serde(default = "default_to_false")]
    pub forbid_guest_text: bool,

    #[serde(default = "default_to_false")]
    pub forbid_guest_url: bool,

    #[serde(default = "default_to_channel_str")]
    pub r#type: String,

    #[serde(default = "default_visibility")]
    pub visibility: String,

    #[serde(default = "default_voice_mode")]
    pub voice_mode: String,

    pub category_id: Option<Uuid>,
    pub server_id: Option<Uuid>,
    
    #[serde(default = "default_to_bigint_zero")]
    pub created_at: i64,
}