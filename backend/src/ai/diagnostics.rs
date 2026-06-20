//! AI-assisted diagnostic scan scaffolding.
//!
//! This module does not call an external model. It prepares deterministic,
//! serializable diagnostic context that can be handed to an AI scanner or
//! reviewed directly by operators.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Backend subsystem covered by an AI diagnostic scan.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub enum DiagnosticSubsystem {
    Discovery,
    Messaging,
    Registry,
    Inference,
    Embeddings,
    Connector,
    Protocol,
    Custom(String),
}

impl DiagnosticSubsystem {
    pub fn as_str(&self) -> &str {
        match self {
            Self::Discovery => "discovery",
            Self::Messaging => "messaging",
            Self::Registry => "registry",
            Self::Inference => "inference",
            Self::Embeddings => "embeddings",
            Self::Connector => "connector",
            Self::Protocol => "protocol",
            Self::Custom(name) => name.as_str(),
        }
    }
}

impl From<&str> for DiagnosticSubsystem {
    fn from(value: &str) -> Self {
        match value {
            "discovery" => Self::Discovery,
            "messaging" => Self::Messaging,
            "registry" => Self::Registry,
            "inference" => Self::Inference,
            "embeddings" => Self::Embeddings,
            "connector" => Self::Connector,
            "protocol" => Self::Protocol,
            other => Self::Custom(other.to_string()),
        }
    }
}

/// Severity used to rank diagnostic signals and findings.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
    Info,
    Warning,
    Error,
    Critical,
}

impl DiagnosticSeverity {
    fn should_report(self) -> bool {
        self >= Self::Warning
    }
}

/// A raw subsystem observation ready for diagnostic scanning.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiagnosticSignal {
    pub subsystem: DiagnosticSubsystem,
    pub name: String,
    pub severity: DiagnosticSeverity,
    pub message: String,
    pub evidence: BTreeMap<String, String>,
    pub tags: BTreeSet<String>,
}

impl DiagnosticSignal {
    pub fn new(
        subsystem: DiagnosticSubsystem,
        name: impl Into<String>,
        severity: DiagnosticSeverity,
        message: impl Into<String>,
    ) -> Self {
        Self {
            subsystem,
            name: name.into(),
            severity,
            message: message.into(),
            evidence: BTreeMap::new(),
            tags: BTreeSet::new(),
        }
    }

    pub fn with_evidence(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.evidence
            .insert(key.into(), redact_sensitive(value.into()));
        self
    }

    pub fn with_tag(mut self, tag: impl Into<String>) -> Self {
        self.tags.insert(tag.into());
        self
    }
}

/// Configuration for a deterministic diagnostic scan.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiScanPlan {
    pub scan_id: String,
    pub model_hint: String,
    pub focus_subsystems: Vec<DiagnosticSubsystem>,
    pub max_findings: usize,
    pub include_prompt_context: bool,
}

impl Default for AiScanPlan {
    fn default() -> Self {
        Self {
            scan_id: "default-ai-diagnostic-scan".to_string(),
            model_hint: "ai-diagnostic-reviewer".to_string(),
            focus_subsystems: Vec::new(),
            max_findings: 25,
            include_prompt_context: true,
        }
    }
}

/// A normalized finding that can be sent to an AI reviewer or displayed as-is.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiagnosticFinding {
    pub id: String,
    pub subsystem: DiagnosticSubsystem,
    pub severity: DiagnosticSeverity,
    pub summary: String,
    pub evidence: BTreeMap<String, String>,
    pub tags: Vec<String>,
    pub suggested_prompt: String,
}

/// Output of a diagnostic scan.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiDiagnosticReport {
    pub scan_id: String,
    pub model_hint: String,
    pub scanned_signals: usize,
    pub findings: Vec<DiagnosticFinding>,
    pub subsystem_counts: BTreeMap<String, usize>,
    pub prompt_context: Option<String>,
}

/// Deterministic scanner that turns subsystem signals into AI-ready findings.
#[derive(Debug, Clone)]
pub struct AiDiagnosticScanner {
    plan: AiScanPlan,
}

impl AiDiagnosticScanner {
    pub fn new(plan: AiScanPlan) -> Self {
        Self { plan }
    }

    pub fn scan(&self, signals: &[DiagnosticSignal]) -> AiDiagnosticReport {
        let focus: BTreeSet<&DiagnosticSubsystem> = self.plan.focus_subsystems.iter().collect();
        let mut subsystem_counts = BTreeMap::new();
        let mut findings = Vec::new();

        for signal in signals {
            if !focus.is_empty() && !focus.contains(&signal.subsystem) {
                continue;
            }

            *subsystem_counts
                .entry(signal.subsystem.as_str().to_string())
                .or_insert(0) += 1;

            if !signal.severity.should_report() {
                continue;
            }

            findings.push(DiagnosticFinding {
                id: stable_finding_id(signal),
                subsystem: signal.subsystem.clone(),
                severity: signal.severity,
                summary: format!("{}: {}", signal.name, signal.message),
                evidence: signal.evidence.clone(),
                tags: signal.tags.iter().cloned().collect(),
                suggested_prompt: build_prompt(signal),
            });
        }

        findings.sort_by(|left, right| {
            right
                .severity
                .cmp(&left.severity)
                .then_with(|| left.subsystem.cmp(&right.subsystem))
                .then_with(|| left.summary.cmp(&right.summary))
        });
        findings.truncate(self.plan.max_findings);

        let prompt_context = self
            .plan
            .include_prompt_context
            .then(|| build_prompt_context(&findings));

        AiDiagnosticReport {
            scan_id: self.plan.scan_id.clone(),
            model_hint: self.plan.model_hint.clone(),
            scanned_signals: signals.len(),
            findings,
            subsystem_counts,
            prompt_context,
        }
    }
}

fn stable_finding_id(signal: &DiagnosticSignal) -> String {
    let mut digest = Sha256::new();
    digest.update(signal.subsystem.as_str().as_bytes());
    digest.update([0]);
    digest.update(signal.name.as_bytes());
    digest.update([0]);
    digest.update(signal.message.as_bytes());
    let hex = format!("{:x}", digest.finalize());
    format!("diag-{}", &hex[..12])
}

fn build_prompt(signal: &DiagnosticSignal) -> String {
    let mut prompt = format!(
        "Review the {} subsystem signal `{}` with {:?} severity. Explain likely root cause, blast radius, and the smallest safe verification step.",
        signal.subsystem.as_str(),
        signal.name,
        signal.severity,
    );

    if !signal.evidence.is_empty() {
        prompt.push_str(" Evidence keys: ");
        prompt.push_str(
            &signal
                .evidence
                .keys()
                .cloned()
                .collect::<Vec<_>>()
                .join(", "),
        );
        prompt.push('.');
    }

    prompt
}

fn build_prompt_context(findings: &[DiagnosticFinding]) -> String {
    if findings.is_empty() {
        return "No warning-or-higher diagnostic findings were detected.".to_string();
    }

    let mut lines = vec![
        "AI diagnostic scan context: prioritize critical and error findings before warnings."
            .to_string(),
    ];

    for finding in findings {
        lines.push(format!(
            "- [{}::{:?}] {}",
            finding.subsystem.as_str(),
            finding.severity,
            finding.summary
        ));
        if !finding.evidence.is_empty() {
            let evidence = finding
                .evidence
                .iter()
                .map(|(key, value)| format!("{}={}", key, value))
                .collect::<Vec<_>>()
                .join("; ");
            lines.push(format!("  evidence: {}", evidence));
        }
    }

    lines.join("\n")
}

fn redact_sensitive(value: String) -> String {
    let lowered = value.to_ascii_lowercase();
    if lowered.contains("password")
        || lowered.contains("secret")
        || lowered.contains("token")
        || lowered.contains("api_key")
    {
        "[redacted]".to_string()
    } else {
        value
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scanner_reports_warning_and_higher_signals() {
        let signals = vec![
            DiagnosticSignal::new(
                DiagnosticSubsystem::Discovery,
                "stale-peer",
                DiagnosticSeverity::Warning,
                "peer has not heartbeated within the expected interval",
            )
            .with_evidence("node", "edge-7")
            .with_tag("liveness"),
            DiagnosticSignal::new(
                DiagnosticSubsystem::Messaging,
                "queue-depth",
                DiagnosticSeverity::Info,
                "queue depth is within normal range",
            ),
        ];

        let report = AiDiagnosticScanner::new(AiScanPlan::default()).scan(&signals);

        assert_eq!(report.scanned_signals, 2);
        assert_eq!(report.findings.len(), 1);
        assert_eq!(report.findings[0].subsystem, DiagnosticSubsystem::Discovery);
        assert_eq!(report.subsystem_counts.get("discovery"), Some(&1));
        assert_eq!(report.subsystem_counts.get("messaging"), Some(&1));
    }

    #[test]
    fn scanner_focuses_subsystems_and_caps_findings() {
        let signals = vec![
            DiagnosticSignal::new(
                DiagnosticSubsystem::Registry,
                "expired-service",
                DiagnosticSeverity::Critical,
                "service TTL expired",
            ),
            DiagnosticSignal::new(
                DiagnosticSubsystem::Messaging,
                "publish-error",
                DiagnosticSeverity::Error,
                "broker rejected a message",
            ),
        ];
        let plan = AiScanPlan {
            focus_subsystems: vec![DiagnosticSubsystem::Messaging],
            max_findings: 1,
            ..AiScanPlan::default()
        };

        let report = AiDiagnosticScanner::new(plan).scan(&signals);

        assert_eq!(report.findings.len(), 1);
        assert_eq!(report.findings[0].subsystem, DiagnosticSubsystem::Messaging);
        assert_eq!(report.subsystem_counts.get("registry"), None);
    }

    #[test]
    fn prompt_context_redacts_sensitive_evidence() {
        let signal = DiagnosticSignal::new(
            DiagnosticSubsystem::Inference,
            "provider-auth",
            DiagnosticSeverity::Error,
            "provider rejected credentials",
        )
        .with_evidence("response", "invalid token abc123");

        let report = AiDiagnosticScanner::new(AiScanPlan::default()).scan(&[signal]);
        let context = report.prompt_context.expect("prompt context");

        assert!(context.contains("[redacted]"));
        assert!(!context.contains("abc123"));
    }
}
