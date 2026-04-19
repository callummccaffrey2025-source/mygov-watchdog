#!/usr/bin/env python3
"""
agent_content_preparation.py — Content Preparation Agent (Agent 5)

Drafts a daily brief by calling the existing Supabase Edge Function
`generate-daily-brief`. Output goes ONLY to content_approval_queue —
never publishes directly.

Checks for editorial language blocklist and flags violations.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import agent_guard

AGENT_NAME = "content_preparation"

EDITORIAL_BLOCKLIST = [
    "caves", "radical", "failed", "slammed", "blasted", "destroyed",
]

log = agent_guard.log


def check_editorial_language(text: str) -> list[str]:
    """Return list of risk flags for any editorial blocklist terms found."""
    flags = []
    text_lower = text.lower()
    for term in EDITORIAL_BLOCKLIST:
        if term in text_lower:
            flags.append(f"editorial_language: contains '{term}'")
    return flags


def main():
    sb = agent_guard.init(AGENT_NAME)
    run_id = agent_guard.log_run_start(sb, AGENT_NAME)

    tokens_used = 0
    cost_usd = 0.0
    rows_written = 0
    rows_flagged = 0

    try:
        # Check cost ceiling before invoking an AI-powered Edge Function
        if not agent_guard.check_cost_ceiling(sb):
            agent_guard.create_alert(
                sb, AGENT_NAME,
                severity="warning",
                alert_type="cost_ceiling_reached",
                subject="Skipping daily brief generation — daily cost ceiling reached",
            )
            agent_guard.log_run_end(
                sb, run_id,
                status="skipped",
                error_message="Daily cost ceiling reached",
            )
            print(json.dumps({
                "rows_read": 0, "rows_written": 0, "rows_flagged": 0,
                "tokens_used": 0, "cost_usd": 0.0, "status": "skipped",
            }))
            sys.exit(0)

        # Invoke the Edge Function
        log.info("Invoking generate-daily-brief Edge Function...")
        try:
            response = sb.functions.invoke(
                "generate-daily-brief",
                invoke_options={"body": {}},
            )
        except Exception as e:
            error_str = str(e)
            # Graceful fallback if Edge Function is not deployed
            if "404" in error_str or "not found" in error_str.lower() or "FunctionsRelayError" in error_str:
                log.warning("Edge Function not deployed — creating info alert")
                agent_guard.create_alert(
                    sb, AGENT_NAME,
                    severity="info",
                    alert_type="edge_function_unavailable",
                    subject="generate-daily-brief Edge Function not deployed",
                    body="The Edge Function could not be reached. Deploy with: "
                         "supabase functions deploy generate-daily-brief "
                         "--project-ref zmmglikiryuftqmoprqm",
                )
                agent_guard.log_run_end(
                    sb, run_id,
                    status="skipped",
                    error_message="Edge Function not deployed",
                )
                print(json.dumps({
                    "rows_read": 0, "rows_written": 0, "rows_flagged": 0,
                    "tokens_used": 0, "cost_usd": 0.0,
                    "status": "skipped", "reason": "edge_function_unavailable",
                }))
                sys.exit(0)
            else:
                raise

        # Parse the response
        if isinstance(response, bytes):
            response_text = response.decode("utf-8")
        elif isinstance(response, str):
            response_text = response
        else:
            response_text = str(response)

        try:
            brief_data = json.loads(response_text)
        except (json.JSONDecodeError, TypeError):
            brief_data = {"raw_response": response_text}

        log.info("Edge Function returned %d bytes", len(response_text))

        # Extract tokens_used if available in response
        if isinstance(brief_data, dict):
            tokens_used = brief_data.get("tokens_used", 0) or 0
            cost_usd = brief_data.get("cost_usd", 0.0) or 0.0

        # Check for editorial language in the content
        content_text = response_text
        if isinstance(brief_data, dict):
            # Also check nested text fields
            for key in ["ai_text", "what_happened", "what_it_means", "one_thing_to_know"]:
                val = brief_data.get(key)
                if isinstance(val, str):
                    content_text += " " + val
                elif isinstance(val, list):
                    for item in val:
                        if isinstance(item, str):
                            content_text += " " + item
                        elif isinstance(item, dict):
                            content_text += " " + json.dumps(item)

        risk_flags = check_editorial_language(content_text)
        if risk_flags:
            rows_flagged += 1
            log.warning("Editorial language detected: %s", risk_flags)

        # Queue the content for human review — never publish directly
        proposed_content = brief_data if isinstance(brief_data, dict) else {"raw_response": response_text}
        if risk_flags:
            proposed_content["risk_flags"] = risk_flags

        entry_id = agent_guard.queue_content(
            sb, AGENT_NAME,
            content_type="daily_brief",
            proposed_content=proposed_content,
        )
        rows_written = 1
        log.info("Queued daily brief for review (entry_id=%s)", entry_id)

        agent_guard.log_run_end(
            sb, run_id,
            status="succeeded",
            rows_written=rows_written,
            rows_flagged=rows_flagged,
            tokens_used=tokens_used,
            cost_usd=cost_usd,
            logs={
                "entry_id": entry_id,
                "risk_flags": risk_flags,
                "response_bytes": len(response_text),
            },
        )

        print(json.dumps({
            "rows_read": 0,
            "rows_written": rows_written,
            "rows_flagged": rows_flagged,
            "tokens_used": tokens_used,
            "cost_usd": cost_usd,
            "entry_id": entry_id,
        }))
        sys.exit(0)

    except Exception as e:
        agent_guard.log_run_end(
            sb, run_id,
            status="failed",
            error_message=str(e),
        )
        log.exception("Content preparation agent failed")
        print(json.dumps({
            "rows_read": 0, "rows_written": 0, "rows_flagged": 0,
            "tokens_used": 0, "cost_usd": 0.0,
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
