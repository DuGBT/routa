//! Provider Adapter Module
//!
//! Normalizes messages from Claude Code to a unified internal format
//! for consistent trace recording.

mod trace_recorder;
mod types;

pub use trace_recorder::TraceRecorder;
pub use types::*;

/// Get the appropriate adapter behavior for a provider.
/// Always returns Claude behavior.
pub fn get_provider_behavior(_provider: &str) -> ProviderBehavior {
    ProviderBehavior {
        provider_type: ProviderType::Claude,
        immediate_tool_input: true, // Claude sends input with tool_call
        streaming: true,
    }
}
