# Executable participant-state abstraction

Run from the repository root with Python 3 (standard library only):

```sh
python docs/model/check_model.py
```

The committed [verification.json](verification.json) is the deterministic output of that command. Compare it with a fresh run after changing the model. Exit zero means the checker found the expected abstract properties and counterexamples; it emphatically does not mean the application is secure.

## What is modeled

The checker exhaustively explores reachable states for two fixed quest identities and three exact names (`Alex`, `alex`, `Blair`). A quest slot progresses from unused to live to deleted; it is never reused, approximating monotonic generated IDs within the bound. Each quest/name pair has Absent, Claimed, or Completed state. Board admission is an externally supplied predicate.

Actions are add, delete, claim, complete, reopen, and unclaim. Successful serialized mutation effects follow the source action mapping. Missing-resource actions are modeled as unchanged state; distinctions between 404, success, and other HTTP errors are omitted. The finite map represents one slot per exact quest/name key; database uniqueness itself is not experimentally verified by this representation.

All explored states/transitions check no-orphan/status properties, denial of mutations with false admission, and independence of other participants during a participant action. A witness demonstrates one completed person coexisting with another claimed person on the same quest.

## Counterexamples that are expected

1. Both `Alex` and `alex` can have records for one quest, violating canonical-name uniqueness the UI would need.
2. Direct complete can create a Completed participant without first claiming.
3. An admitted actor labeled Blair can submit Alex as target; no principal-target ownership condition exists in the transition.
4. An abstract copied token remains valid after browser logout and beyond cookie lifetime, while a configuration rotation invalidates it.

The last two are explicit small demonstrations of the modeled authorization/session policy, not exhaustive exploration of identity, browsers, or cryptography. They do not use real credentials or contact a network.

## Limits and relationship to the full specification

This is a bounded state exploration of an independently authored abstraction. It is not TLA+/Alloy verification, a theorem proof over arbitrary users/quests, a symbolic execution of TypeScript, a production penetration test, or a test of D1. The [formal system model](../FORMAL_MODEL.md) supplies the wider architecture, browser/storage model, derived view semantics, data constraints, failure behavior, and desired security properties.

Excluded from exhaustive exploration: creator text, legacy claims, timestamps/score, UI matching order, input parsing, database/HTTP exceptions, partial commits, concurrent interleavings, provider routing, effective browser cookies, and dependency compromise. In particular, the serialized delete transition is atomic in the abstraction; the real handler issues two SQL calls and is not guaranteed atomic. The no-orphan abstract result cannot establish all-or-nothing production deletion.

Before using the model as a release gate, connect every new implementation policy to isolated API/database tests and extend the abstraction for the relevant race, ownership or migration semantics. Deliberately updating the model to remove a counterexample is not evidence that the runtime was fixed; both source and verification evidence must change.
