"""Minimal LangChain agent wrapper (optional).

The LLM only picks the action; all security (proof, digest, token) is handled
by the gateway_client, never by the LLM.

If LangChain/OpenAI are not installed or no API key is set, the agent
falls back to a deterministic action list.
"""

from __future__ import annotations


def pick_action_deterministic() -> list[dict]:
    """Return a fixed list of actions for --no-llm mode."""
    return [
        {"action": "read", "resource": "staging-database", "description": "Read customer records"},
        {"action": "query", "resource": "staging-database", "description": "Query analytics data"},
    ]


def pick_action_llm(user_request: str) -> dict:
    """Use LangChain + OpenAI to decide what action to take.

    Returns {"action": str, "resource": str}.
    Raises ImportError if langchain is not installed.
    """
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.messages import HumanMessage, SystemMessage
        import json

        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
        messages = [
            SystemMessage(content=(
                "You are a data analytics agent. Given a user request, decide what action to take. "
                "Respond with ONLY a JSON object: {\"action\": \"<action>\", \"resource\": \"<resource>\"}. "
                "Actions: read, query, list, search, analyze. "
                "Resources: staging-database, staging-analytics-api, dev-database."
            )),
            HumanMessage(content=user_request),
        ]
        response = llm.invoke(messages)
        return json.loads(response.content)
    except ImportError:
        raise ImportError(
            "LangChain not installed. Use --no-llm flag or install: "
            "pip install langchain langchain-openai"
        )
