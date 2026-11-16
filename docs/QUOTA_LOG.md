# Albena RMS — AI Usage & Quota Log

Quota preservation is a critical operational requirement for the Albena RMS project.

## 1. Monitoring & Protection Thresholds

- **Standard Monitoring**: Quota status inspected before starting each session, before major implementation tasks, after completing each milestone, and before expensive tasks.
- **WARNING THRESHOLD (25% remaining)**: Immediately notify project owner and prepare detailed progress & handover report.
- **STOP THRESHOLD (15% remaining)**: Cease all AI code generation, commit and persist all work, finalize progress logs, and provide handover. No optional work permitted.
- **Zero Fabrication Rule**: If quota values cannot be queried directly via system API, explicitly mark as "Unknown / User-Monitored via `/usage` or `/quota`". Never estimate or fabricate quota values.

---

## 2. Quota Ledger

| Timestamp (UTC+3) | Model / Group | Remaining Quota / Status | Reset Window | Work Completed Since Previous Check | Development Safe to Continue? |
| :--- | :--- | :--- | :--- | :--- | :---: |
| 2026-11-16 12:35 | Gemini 3.8 Flash (High) | User-Monitored (UI `/usage`) | Rolling window | Initial repository inspection, security setup (`.gitignore`, `.env.example`), governance initialization (`PROJECT_STATUS.md`, `ROADMAP.md`, `PROGRESS_LOG.md`, `DECISIONS.md`, `REQUIREMENTS_TRACEABILITY.md`, `QUOTA_LOG.md`). | **YES** (Phase 0 Setup complete) |
| 2026-11-16 12:38 | Gemini 3.8 Flash (High) | User-Monitored (UI `/usage`) | Rolling window | Milestone M0 formal approval, progress status advancement to 5.0%. | **YES** (Ready for SRS ingestion) |

---

## 3. Quota Optimization Practices
1. Work in focused, well-defined micro-milestones.
2. Rely on localized, sandboxed tool calls where possible.
3. Keep automated command execution concise and targeted.
4. Avoid repetitive or redundant test cycles.
5. Pause before entering heavy code-generation tasks until the user approves architectural roadmaps.
