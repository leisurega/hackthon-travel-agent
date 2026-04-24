"""Scoring engine.

P3 owns this file. The current implementation is a *working placeholder* so
that P1 can wire the graph end-to-end without blocking -- P3 should replace
the body with the documented formula while keeping the same signature.

Signature contract:
    score(proposal: dict, profiles: list[dict], conflicts: list[dict]|None=None)
        -> Score dict (see state.Score)

Formula reminder (for P3):
    F        = 100 - 10 * hard_conflicts
    S_i      = 100 - 5*len(gave_up) + 3*len(met) - 2*len(anti_pref_hit)
    S_avg    = mean(S_i)
    S_min    = min(S_i)
    Fairness = 100 - 3 * (max(S_i) - min(S_i))
    final    = 0.25*F + 0.25*S_avg + 0.35*S_min + 0.15*Fairness

After replan, `final` should end up 2-4 points higher than the initial run.
"""
from __future__ import annotations

from statistics import mean
from typing import Any, Dict, List, Optional


# Placeholder satisfaction table keyed by user_id. P3 will replace this with
# the real derivation from profiles vs proposal, but for now it lets the
# pipeline run end-to-end.
_PLACEHOLDER_USER_SAT: Dict[str, int] = {"A": 88, "B": 82, "C": 80, "D": 86}
_PLACEHOLDER_USER_SAT_AFTER_REPLAN: Dict[str, int] = {"A": 82, "B": 87, "C": 82, "D": 86}


def score(
    proposal: Dict[str, Any],
    profiles: List[Dict[str, Any]],
    conflicts: Optional[List[Dict[str, Any]]] = None,
    is_replan: bool = False,
) -> Dict[str, Any]:
    hard_count = (
        sum(1 for c in (conflicts or []) if c.get("is_hard"))
        if conflicts is not None
        else 2
    )
    F = max(0, min(100, 100 - 10 * hard_count))

    table = _PLACEHOLDER_USER_SAT_AFTER_REPLAN if is_replan else _PLACEHOLDER_USER_SAT
    per_user = []
    s_values: List[int] = []
    for p in profiles:
        uid = p.get("user_id")
        sat = table.get(uid, 75)
        s_values.append(sat)
        per_user.append(
            {
                "user_id": uid,
                "satisfaction": sat,
                "met": [],          # P3 fills
                "gave_up": [],      # P3 fills
                "compensation": [], # P3 fills
            }
        )

    S_avg = int(mean(s_values)) if s_values else 0
    S_min = min(s_values) if s_values else 0
    Fairness = max(0, 100 - 3 * (max(s_values) - min(s_values))) if s_values else 100
    final = int(0.25 * F + 0.25 * S_avg + 0.35 * S_min + 0.15 * Fairness)

    return {
        "final": final,
        "F": F,
        "S_avg": S_avg,
        "S_min": S_min,
        "Fairness": Fairness,
        "per_user": per_user,
    }
