//! Providers API - Claude Code only provider listing
//!
//! GET /api/providers - List Claude Code provider info

use axum::{
    extract::State,
    routing::get,
    Json, Router,
};

use crate::error::ServerError;
use crate::state::AppState;

#[derive(Debug, Clone, serde::Serialize)]
struct ProviderInfo {
    id: String,
    name: String,
    description: String,
    command: String,
    status: String,
    source: String,
}

pub fn router() -> Router<AppState> {
    Router::new().route("/", get(list_providers))
}

async fn list_providers(
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, ServerError> {
    use crate::shell_env;

    let installed = shell_env::which("claude").is_some();

    let providers = vec![ProviderInfo {
        id: "claude".to_string(),
        name: "Claude Code".to_string(),
        description: "Anthropic Claude Code (stream-json protocol)".to_string(),
        command: "claude".to_string(),
        status: if installed {
            "available".to_string()
        } else {
            "unavailable".to_string()
        },
        source: "static".to_string(),
    }];

    Ok(Json(serde_json::json!({ "providers": providers })))
}
