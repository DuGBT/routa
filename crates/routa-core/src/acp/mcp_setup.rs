//! MCP setup for Claude Code in the Rust backend.
//!
//! Builds inline MCP config JSON for Claude Code sessions.

use serde_json::Value;

fn build_mcp_endpoint(
    workspace_id: &str,
    session_id: &str,
    tool_mode: Option<&str>,
    mcp_profile: Option<&str>,
) -> String {
    let base_url =
        std::env::var("ROUTA_SERVER_URL").unwrap_or_else(|_| "http://127.0.0.1:3210".to_string());

    let mut params = vec![
        format!("wsId={}", workspace_id),
        format!("sid={}", session_id),
    ];

    if let Some(mode) = tool_mode.filter(|value| *value == "essential" || *value == "full") {
        params.push(format!("toolMode={}", mode));
    }

    if let Some(profile) =
        mcp_profile.filter(|value| *value == "kanban-planning" || *value == "team-coordination")
    {
        params.push(format!("mcpProfile={}", profile));
    }

    format!("{}/api/mcp?{}", base_url, params.join("&"))
}

pub fn build_claude_mcp_config(
    workspace_id: &str,
    session_id: &str,
    tool_mode: Option<&str>,
    mcp_profile: Option<&str>,
) -> String {
    serde_json::json!({
        "mcpServers": {
            "routa-coordination": {
                "url": build_mcp_endpoint(workspace_id, session_id, tool_mode, mcp_profile),
                "type": "http",
                "env": {
                    "ROUTA_WORKSPACE_ID": workspace_id,
                },
            }
        }
    })
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::{build_claude_mcp_config, build_mcp_endpoint};

    #[test]
    fn team_coordination_profile_is_forwarded_in_mcp_endpoint() {
        let endpoint = build_mcp_endpoint(
            "default",
            "session-123",
            Some("essential"),
            Some("team-coordination"),
        );
        assert!(endpoint.contains("wsId=default"));
        assert!(endpoint.contains("sid=session-123"));
        assert!(endpoint.contains("toolMode=essential"));
        assert!(endpoint.contains("mcpProfile=team-coordination"));
    }

    #[test]
    fn claude_inline_config_uses_routa_coordination_server() {
        let config = build_claude_mcp_config(
            "default",
            "session-123",
            Some("essential"),
            Some("team-coordination"),
        );
        assert!(config.contains("\"routa-coordination\""));
        assert!(config.contains("\"type\":\"http\""));
        assert!(config.contains("mcpProfile=team-coordination"));
    }
}
