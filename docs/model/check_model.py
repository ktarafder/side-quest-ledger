"""Offline bounded model of successful serialized participant mutations.

This is a specification checker, not a production API test. No network, secrets,
third-party packages, or database are used. See README.md for abstraction limits.
"""

from collections import deque
from dataclasses import dataclass
import json

NAMES = ("Alex", "alex", "Blair")
QUESTS = 2
UNUSED, LIVE, DELETED = range(3)
ABSENT, CLAIMED, COMPLETED = range(3)
INITIAL = ((UNUSED,) * QUESTS, (ABSENT,) * (QUESTS * len(NAMES)))


@dataclass(frozen=True)
class Action:
    kind: str
    quest: int
    target: int = 0

    def describe(self):
        suffix = f"[{NAMES[self.target]}]" if self.kind not in ("add", "delete") else ""
        return f"{self.kind}(quest={self.quest}){suffix}"


ACTIONS = tuple(
    Action(kind, quest, target)
    for quest in range(QUESTS)
    for kind, targets in (
        ("add", (0,)),
        ("delete", (0,)),
        ("claim", range(len(NAMES))),
        ("complete", range(len(NAMES))),
        ("reopen", range(len(NAMES))),
        ("unclaim", range(len(NAMES))),
    )
    for target in targets
)


def slot(quest, name):
    return quest * len(NAMES) + name


def next_state(state, action, admitted=True):
    """Abstract app guard, successful SQL effects, and absent-resource no-ops.

    Actor identity is intentionally not a parameter: current API operations
    use the submitted target name, not an authenticated individual principal.
    HTTP status, row IDs, timestamps and failed SQL are outside this function.
    """
    if not admitted:
        return state
    quests, participants = map(list, state)
    quest = action.quest
    if action.kind == "add":
        if quests[quest] == UNUSED:
            quests[quest] = LIVE
    elif quests[quest] == LIVE:
        if action.kind == "delete":
            quests[quest] = DELETED
            for name in range(len(NAMES)):
                participants[slot(quest, name)] = ABSENT
        else:
            participants[slot(quest, action.target)] = {
                "claim": CLAIMED,
                "complete": COMPLETED,
                "reopen": CLAIMED,
                "unclaim": ABSENT,
            }[action.kind]
    return tuple(quests), tuple(participants)


def no_orphans(state):
    quests, participants = state
    return all(
        status == ABSENT or quests[index // len(NAMES)] == LIVE
        for index, status in enumerate(participants)
    )


def no_canonical_collision(state):
    for quest in range(QUESTS):
        names = [
            name.lower()
            for index, name in enumerate(NAMES)
            if state[1][slot(quest, index)] != ABSENT
        ]
        if len(names) != len(set(names)):
            return False
    return True


def trace_to(state, parents):
    trace = []
    while parents[state] is not None:
        state, action = parents[state]
        trace.append(action.describe())
    return list(reversed(trace))


def check():
    queue = deque([INITIAL])
    parents = {INITIAL: None}
    transitions = 0
    collision = None
    coexistence = None
    while queue:
        state = queue.popleft()
        if not no_orphans(state):
            raise AssertionError("Abstract no-orphan property failed")
        if any(status not in (ABSENT, CLAIMED, COMPLETED) for status in state[1]):
            raise AssertionError("Abstract status range failed")
        if not no_canonical_collision(state) and collision is None:
            collision = trace_to(state, parents)
        if coexistence is None and state[1][slot(0, 0)] == COMPLETED and state[1][slot(0, 2)] == CLAIMED:
            coexistence = trace_to(state, parents)
        for action in ACTIONS:
            successor = next_state(state, action)
            transitions += 1
            if next_state(state, action, admitted=False) != state:
                raise AssertionError("Abstract admission guard failed")
            if action.kind not in ("add", "delete"):
                target = slot(action.quest, action.target)
                if any(
                    before != after
                    for index, (before, after) in enumerate(zip(state[1], successor[1]))
                    if index != target
                ):
                    raise AssertionError("Abstract independent participation failed")
            if successor not in parents:
                parents[successor] = (state, action)
                queue.append(successor)

    live = next_state(INITIAL, Action("add", 0))
    direct_complete = next_state(live, Action("complete", 0, 0))
    impersonated = next_state(live, Action("claim", 0, 0))
    if direct_complete[1][slot(0, 0)] != COMPLETED:
        raise AssertionError("Expected complete-before-claim counterexample disappeared")
    if impersonated[1][slot(0, 0)] != CLAIMED or collision is None or coexistence is None:
        raise AssertionError("Expected model witnesses missing")

    # Abstract token captures the source predicate: epoch/config equality only.
    # No actual authentication value or cryptographic implementation is used.
    def accepts_token(token_epoch, config_epoch, now):
        return token_epoch == config_epoch

    stolen_copy = "configuration-epoch-1"
    # Browser logout removes its cookie; configuration remains unchanged.
    assert accepts_token(stolen_copy, "configuration-epoch-1", now=31 * 86400)
    assert not accepts_token(stolen_copy, "configuration-epoch-2", now=31 * 86400)

    return {
        "scope": "bounded successful serialized application abstraction; no production verification",
        "bounds": {"quests": QUESTS, "exact_names": list(NAMES)},
        "reachable_states": len(parents),
        "enumerated_transitions_including_no_ops": transitions,
        "checked_abstract_properties": [
            "No participants on unused/deleted quests",
            "Allowed participant status range",
            "No state mutation when admission predicate is false",
            "A participant mutation leaves every other participant unchanged",
        ],
        "witness_multiple_independent_participants": coexistence,
        "expected_counterexamples": {
            "case_insensitive_identity_uniqueness": collision,
            "claim_required_before_complete": ["add(quest=0)", "complete(quest=0)[Alex]"],
            "actor_must_equal_target": {
                "actor_label": "Blair",
                "submitted_target": "Alex",
                "trace": ["add(quest=0)", "claim(quest=0)[Alex]"],
                "reason": "Actor not used by current transition policy",
            },
            "logout_or_browser_lifetime_revokes_token": {
                "trace": ["login copies shared token", "browser logout clears cookie", "replay copy after 31 days"],
                "accepted_in_abstract_predicate": True,
                "configuration_rotation_rejects_old_copy": True,
            },
        },
        "excluded": [
            "HTTP/router/provider/cookie-policy correctness",
            "Actual TypeScript implementation execution",
            "Legacy synthetic participants and creator fields",
            "Malformed inputs, point coercion, timestamps and UI ordering",
            "SQL constraints, failures, races and partial commits",
            "Cryptographic entropy or token-guessing resistance",
            "Dependency, browser, identity-provider or deployment security",
        ],
    }


if __name__ == "__main__":
    print(json.dumps(check(), indent=2))
