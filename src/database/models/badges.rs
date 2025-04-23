use uuid::Uuid;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Badges {
    pub id: Uuid,

    #[serde(default = "default_name")]
    pub name: String,
    pub description: String,
}

fn default_name() -> String {
    "Unknown".to_string()
}