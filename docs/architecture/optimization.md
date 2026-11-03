# Spatial optimization architecture

Optimization and priority ranking share one canonical coupled numerical path:

```text
OptimizationProblem { target_area, objectives, constraints, neighbor_penalty, decision_domain }
  -> planning-unit domain and run-wide layer normalization
  -> spatial coefficient preparation
  -> CompiledOptimizationModel (solver-neutral CSR)
  -> HiGHS
  -> independent validation and spatial reconstruction
  -> canonical result map
```

Dask performs spatial-to-numerical compilation only. It reads the chunked layer
library, applies explicit AOI, planning-unit constraints, and NoData semantics,
normalizes every objective with a deterministic run-wide attainable-contribution
scale, resolves signed coefficients from direction and nonnegative importance, derives aggregate constraint
rows, and emits deterministic
planning-unit mappings and sparse numerical arrays. HiGHS owns generic presolve,
LP relaxation, cuts, branch-and-bound, bounds, heuristics, and gap reasoning.

Before emitting the generic matrix, the compiler performs a narrow lossless
domain presolve. A flexible planning unit is fixed out only when removing it
cannot make any aggregate bound harder to satisfy and its best possible direct
plus selected-neighbour contribution is non-positive. The rule repeats after
neighbour removals until stable. The submitted neighbour normalization remains
unchanged, so this reduction preserves the mathematical objective rather than
renormalizing the smaller solver model. HiGHS still owns all generic MILP
presolve and search decisions.

Every supported formulation uses the same compiled-model and HiGHS adapter.
Cost has no privileged compiler representation: it is an ordinary layer that can
appear in an objective, an aggregate constraint, or both. Planning-unit
constraints filter candidates; aggregate constraints become CSR rows; the
optional neighbor preference remains the only pairwise special case. The compiled artifact
records each objective's normalization method, scale, submitted importance, and
resolved coefficient.

The two top-level optimization products differ only in planning-unit decision
domain and output semantics. Continuous optimization uses fractional variables
with `0 <= x_i <= 1` and publishes a continuous allocation-intensity surface.
Discrete optimization uses the same bounds plus binary integrality, `x_i in {0,1}`,
and publishes a selected/not-selected decision surface. Existing legacy
`optimization` records are interpreted as discrete optimization.

Priority ranking is a separate top-level analysis built on the same compiler,
HiGHS adapter, artifact lifecycle, and publication pipeline. It is intentionally
a whole-AOI, Jung-inspired nested priority surface rather than prioritizr's
reference-solution `eval_rank_importance()` semantics. The compiler emits
continuous primary variables, preserves the full eligible planning-unit domain,
and includes one reserved `priority_allocation_target` row. The ranking flow
uses fixed v1 budget fractions `{0.1, 0.2, ..., 1.0}`, solves one LP per
increment with the exact equality `sum_i x_i = b_k N`, and updates primary
lower bounds from the previous increment to enforce `x_i^(k) >= x_i^(k-1)`.
The canonical priority score is `P_i = mean_k(x_i^(k))`, so it measures how
early and persistently an eligible planning unit is allocated as conservation
area expands across the AOI. If exact allocation is infeasible under submitted
constraints, the run fails with per-budget diagnostics instead of relaxing to a
`<=` budget. Priority outputs are continuous `0..1` priority surfaces with
NoData outside the eligible AOI; they are not probabilities, irreplaceability,
or replacement-cost values.

Objective normalization is applied only while constructing solver objective
coefficients. Canonical planning-unit layer values remain unchanged and are
retained with the compiled artifact. Aggregate constraint rows always use those
canonical values and user bounds in their declared domain units. The initial
`top_k_attainable` policy uses the authoritative maximum selectable count; when
no narrower cardinality exists in the problem, K is the complete eligible
planning-unit count. A layer with no positive attainable contribution receives
a zero coefficient and explicit `degenerate` provenance rather than an epsilon.

The neighbor term rewards each unordered rook-adjacent pair whose two planning
units are selected. It uses one continuous auxiliary only for flexible-flexible
edges and two linear upper-bound rows; fixed-out edges disappear and fixed-in
edges reduce to unary objective coefficients. No polygon boundary geometry or
exact selected/unselected cut is compiled. The selected-pair count is divided by
the number of edges that can attain a selected pair after fixed decisions are
applied. Strength is therefore a relative soft preference rather than an
unscaled graph-size multiplier.

`SolveConfiguration` is authoritative for time, relative and absolute gaps,
thread count, deterministic seed, logging, and solve mode. Standard mode accepts
a validated feasible incumbent and records its best bound and gap. Exact-audit
mode requires a HiGHS-proven optimum with zero certified gap.

The automatic incumbent is intentionally small in scope. It constructs one
feasible primary selection, includes potential selected-neighbour value in its
single-resource ordering, and always derives the corresponding neighbour
auxiliary columns before handing the incumbent to HiGHS. Solve diagnostics
record original and HiGHS-presolved rows, columns, integer columns, and nonzeros,
along with node and iteration telemetry; they do not prescribe solver tuning.

Irreplaceability, replacement-cost analysis, reference-solution rank importance,
counterfactual per-cell solves, and solution-frequency analysis are not part of
the current canonical optimization execution path. They may be added later as
separate analytical capabilities.

The cutover migration removes superseded product, execution, artifact, and
solution records. No compatibility execution or publication path remains.
