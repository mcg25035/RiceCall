use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::defaults_for_models::{
    default_str,
    default_to_zero,
    default_to_bigint_zero,
};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Users {
    pub user_id: Uuid,

    #[serde(default = "default_str")]
    pub username: String,

    #[serde(default = "default_str")]
    pub avatar: String,

    #[serde(default = "default_str")]
    pub avatar_url: String,

    #[serde(default = "default_str")]
    pub signature: String,

    #[serde(default = "default_country")]
    pub country: String,

    #[serde(default = "default_to_zero")]
    pub level: u32,

    #[serde(default = "default_to_zero")]
    pub vip: u32,

    #[serde(default = "default_to_zero")]
    pub xp: u32,

    #[serde(default = "default_to_zero")]
    pub required_xp: u32,

    #[serde(default = "default_to_zero")]
    pub progress: u32,

    #[serde(default = "default_to_birth_year")]
    pub birth_year: u16,

    #[serde(default = "default_to_birth_month")]
    pub birth_moth: u8,

    #[serde(default = "default_to_birth_day")]
    pub birth_day: u8,

    #[serde(default = "default_status")]
    pub status: String,

    #[serde(default = "default_gender")]
    pub gender: String,

    pub current_channel_id: Uuid,
    pub current_server_id: Uuid,

    #[serde(default = "default_to_bigint_zero")]
    pub last_active_at: i64,
    
    #[serde(default = "default_to_bigint_zero")]
    pub created_at: i64,
}

fn default_country() -> String {
    return "taiwan".to_string();
}

fn default_to_birth_year() -> u16 {
    return 1900;
}

fn default_to_birth_month() -> u8 {
    return 1;
}

fn default_to_birth_day() -> u8 {
    return 1;
}

fn default_status() -> String {
    return "offline".to_string();
}

fn default_gender() -> String {
    return  "Male".to_string();
}