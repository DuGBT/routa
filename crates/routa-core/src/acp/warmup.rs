//! ACP Warmup Service
//!
//! No-op stub since Claude Code does not need pre-warming.

use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use super::paths::AcpPaths;

// ─── Types ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WarmupState {
    Idle,
    Warming,
    Warm,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarmupStatus {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    pub state: WarmupState,
    #[serde(rename = "startedAt", skip_serializing_if = "Option::is_none")]
    pub started_at: Option<u64>,
    #[serde(rename = "finishedAt", skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl WarmupStatus {
    fn idle(agent_id: &str) -> Self {
        Self {
            agent_id: agent_id.to_string(),
            state: WarmupState::Idle,
            started_at: None,
            finished_at: None,
            error: None,
        }
    }
}

// ─── AcpWarmupService ─────────────────────────────────────────────────────

/// Manages pre-warming of agent packages. No-op for Claude Code.
pub struct AcpWarmupService {
    #[allow(dead_code)]
    paths: AcpPaths,
    states: Arc<RwLock<HashMap<String, WarmupStatus>>>,
}

impl AcpWarmupService {
    pub fn new(paths: AcpPaths) -> Self {
        Self {
            paths,
            states: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn is_warming_up(&self, _agent_id: &str) -> bool {
        false
    }

    pub async fn is_warmed_up(&self, _agent_id: &str) -> bool {
        false
    }

    pub async fn needs_warmup(&self, _agent_id: &str) -> bool {
        false
    }

    pub async fn get_status(&self, agent_id: &str) -> WarmupStatus {
        self.states
            .read()
            .await
            .get(agent_id)
            .cloned()
            .unwrap_or_else(|| WarmupStatus::idle(agent_id))
    }

    pub async fn get_all_statuses(&self) -> Vec<WarmupStatus> {
        self.states.read().await.values().cloned().collect()
    }

    pub async fn warmup_in_background(&self, _agent_id: &str) {
        // Claude Code does not need pre-warming
    }

    pub async fn warmup(&self, _agent_id: &str) -> Result<bool, String> {
        // Claude Code does not need pre-warming
        Ok(true)
    }
}
