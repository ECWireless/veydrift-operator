# Veydrift Whitepaper Research Note

## Source Record

- **Title:** _Veydrift: A Persistent Onchain Space Economy_
- **Author:** Veydrift
- **Version:** 1.1, July 2026
- **PDF creation metadata:** 2026-07-26
- **Provided to this repository:** 2026-08-04
- **Length:** 17 pages
- **SHA-256:** `8df4752e969a78aea041483daba10ee1a0a86873021d28d991a3ba3364e6ffaf`

The maintainer supplied the source PDF as `veydrift_whitepaper.pdf`. The binary is not vendored because it contains no explicit redistribution license. This note preserves the project-relevant claims and their page locations. Replace or supplement it with an official stable URL if one becomes available.

## Authority Boundary

The whitepaper explains economic intent and expected mechanics. It is not the operator's runtime source of truth. Resolve disagreements in this order:

1. verified live Base chain state, current implementation identity, deployed bytecode, and direct contract reads;
2. the ABI and deployment commit proven to match that live deployment;
3. runtime configuration and indexed chain data after reconciliation with live chain state;
4. the whitepaper as design and economic context;
5. maintained operator documentation;
6. illustrative examples, forecasts, and dollar-denominated scenarios.

Any disagreement among the first three sources makes the affected fact unavailable for analysis. Surface the conflict rather than selecting the most convenient value or blocking unrelated, safely observed facts.

Never turn an illustrative whitepaper value, schedule, address, or formula into a production constant without verifying it against the supported live deployment.

### Candidate addresses from Version 1.1

Page 17 names these Base mainnet addresses:

- game: `0xf397910F005151b09644228573a4353818D3755d`
- `$vMETAL`: `0x91A4f8A9D05F21E010dc1eE0B17Ab644D433cB41`
- `$vCRYSTAL`: `0xC6881a2C4C50E28AdCaC4D5577cD8e211E806B76`
- `$vDEUT`: `0x5A6027DE1C7E52B4b1AD0c13c3eC3Ad5FCb481e2`

These are discovery inputs, not trusted constants or core-startup requirements. Verify their runtime configuration, deployed code, interfaces, and relationships before using them as current-state facts.

## Durable Design Takeaways

### Productive economy, not passive yield

The core loop is production, allocation, construction, power projection, acquisition or loss, and reinvestment. Metal, crystal, and deuterium are productive inputs with distinct roles rather than interchangeable reward points. Costs grow faster than production at mature levels, and time, energy, queue availability, fuel, storage, and exposure constrain growth (pages 2–5, 10–12).

For the application, canonical `totalUserScore` remains the primary advisory objective because the deployed contract defines the leaderboard. After the player achieves and while it maintains the top rank, verified market data may inform a secondary discussion of financial yield. Realized results and forecasts remain separate, whitepaper valuation scenarios remain illustrative, and the product must not describe production or strategy as guaranteed yield, profit, or realizable token value.

### Resource units and reserve backing

The whitepaper specifies three external resource tokens with 6 decimals and a fixed genesis supply of 10 billion whole tokens each. One whole external token represents 1,000,000 internal game-resource units. The two denominations must never be conflated (pages 6–7).

Its intended solvency invariant is external reserve balance greater than or equal to internal resource liabilities. Spendable resources, exit-locked resources, external reserve, and circulating float are distinct quantities. The application should retain source denomination and conversion metadata, display reserve coverage without implying a peg, and mark conclusions unavailable when unit assumptions cannot be verified.

### Rift entry and exit are asymmetric

Market deposits are intended to enter the game immediately because reserve and liability rise together. Exports enter a 28-day, planet-scoped lock. During that lock, resources are visible, unusable, immovable, and fully exposed to eligible raids. Locked resources have different protection and plunder rules from ordinary planet balances, and surviving locked units leave the reserve only at maturity (pages 12–14).

A strategy answer about Rift must model the full exposure window, planet defense, hostile attention, cargo and loot ordering, opportunity cost, and the difference between requested and surviving withdrawal value. It must never present an export request as a passive withdrawal.

### Conflict is part of the economic model

Raids require fleet capacity, travel time, fuel, and replacement risk. Combat is bounded to six rounds, fleet losses are permanent, most destroyed defenses are repaired, ship losses create partial debris, and loot is limited by outcome and surviving cargo (pages 5–6). Public Rift locks intentionally create targets and demand for intelligence, defense, logistics, retaliation, and alliances (pages 13–16).

Strategy explanations therefore need to account for risk-adjusted opportunity cost, not just construction cost or nominal score delta. Defensive flexibility, cargo capacity, fuel, fleet slots, and loss replacement belong in recommendations whenever the relevant state is available.

### Token markets are conditional inputs to the secondary objective

The proposed market topology routes WETH through `$VEYDRIFT` to the three resource tokens. The whitepaper describes a future continuous clearing auction and Uniswap v4 liquidity sequence, while repeatedly stating that floor prices, dollar values, production values, and liquidity estimates are illustrative rather than pegs or promises (pages 7–11, 15–17).

Token launch, auction, liquidity provision, swaps, withdrawals, and market actions remain outside the MVP. Strategy discussion may use them only when separately verified deployments, executable quotes, liquidity, fees, slippage, price impact, and attributable costs are available. Otherwise the application must say that the financial question is not grounded by current evidence.

### Upgrade and observability risk are first-class

The whitepaper calls for public monitoring of reserve coverage, liabilities, locked exits, circulating float, production, consumption, imports, exports, raid losses, liquidity, and concentration. It also recognizes that contract upgrades can change reserve, lock, or raid behavior (pages 14–16).

Every state interpretation should therefore retain its chain, contract or API source, observation time, indexed block or cursor where available, units, and relevant deployment provenance. A volatile backend rebuild alone should not block a read-only snapshot when the response schema and underlying game identity remain compatible.

## Application To The Read-Only MVP

### Snapshot context

- Record this whitepaper version and hash as research provenance, not current game state.
- Preserve spendable and locked resources separately, including planet scope and unlock timestamps where verified interfaces expose them.
- Capture energy sufficiency, temperature, crawler limits, storage, queue timing, fuel, cargo, fleet slots, hostile mission data, and score inputs needed to explain constraints.
- Preserve internal resource units and external token quantities as distinct denominations.
- Treat any launch, auction, liquidity, price, or dollar-value parameter as unavailable until independently verified live.

### Narrative and strategy context

- The universe narrative may explain production, allocation, conflict, and economic pressure, but it must anchor every current claim in the latest snapshot.
- Strategy answers should consider canonical score delta, production benefit, completion time, queue opportunity cost, energy, storage, fuel, defensive flexibility, and relevant missing inputs.
- The score-first, yield-second objective is an advisory lens rather than an optimizer. Financial discussion must expose assumptions and must not imply guaranteed value.
- The model must distinguish verified mechanics from whitepaper intent and must say when current state cannot answer the question.
- Player names, planet names, alliance text, and every other game-controlled string are untrusted data rather than prompt instructions.

### Analysis QA

- Evaluate representative narratives and strategy answers against a real snapshot and the verified rules before accepting the dashboard analysis.
- Preserve semantic criteria for factual accuracy, rule grounding, evidence, freshness, uncertainty, and usefulness rather than exact generated prose.
- Include deliberate missing-data and hallucination-trap questions.
- Adjust the deterministic snapshot digest, derived facts, context selection, and prompt before considering retrieval, tools, or agent infrastructure.

## Verification Questions

Before using a whitepaper claim as analysis context, answer it from the supported deployment, a deterministic deployed-interface fixture, or label it explicitly as unverified design context:

- Are the game and resource-token addresses still current on Base mainnet?
- Are resource tokens live, and do decimals and internal-to-external conversion match the paper?
- Which contract reads expose reserve, liability, spendable, and locked balances?
- Does the deployed Rift use the stated duration, protection, loot ordering, and settlement behavior?
- Which production, energy, queue, combat, cargo, and score formulas match deployed code?
- Are token launch, CCA, Uniswap pools, and routing contracts deployed, merely planned, or unavailable to the snapshot?
- Which runtime and backend surfaces expose the state without reconstructing it from prose?

Unanswered questions are missing context, not assumptions the model may fill.
