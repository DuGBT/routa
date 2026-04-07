//! `routa acp` — ACP agent management commands.
//!
//! Provides:
//!   - `routa acp serve` — Run Routa as an ACP server over stdio

use clap::Subcommand;

#[derive(Subcommand)]
pub enum AcpAction {
    /// Run Routa as an ACP server over stdio (Claude Code can connect to it).
    Serve {
        /// Workspace ID
        #[arg(long, default_value = "default")]
        workspace_id: String,
        /// Default provider (always "claude")
        #[arg(long, default_value = "claude")]
        provider: String,
    },
}

#[derive(Args, Clone, Debug)]
pub struct TopLevelInstallArgs {
    pub agent_id: Option<String>,
    #[arg(long)]
    pub dist: Option<String>,
}

#[derive(Args, Clone, Debug)]
pub struct TopLevelUninstallArgs {
    pub agent_id: Option<String>,
}
