insert into public.challenges
  (id, title, brief_md, csv_url, stage2_questions, rubric_structure, rubric_memo)
values (
  '22222222-2222-4222-8222-222222222222',
  'Crumb & Crust: Was our 10% price rise smart?',

  $brief$
## Crumb & Crust, a neighbourhood bakery

The owner writes:

> "Last month I raised prices by 10% across all three of our signature bakes to offset rising rent. Fewer customers bought Cinnamon rolls and Croissants, though Sourdough barely budged. Did the price increase actually make us more money overall, or did the volume drop hurt us? Which items should keep the higher price?"

**Data:** `bakery_pricing.csv`
- `Before` is the month before the price increase; `After` is the month following the 10% price increase across all products.
- `unit_cost` is the variable cost per item (flour, butter, packaging).

**Definitions & Method (Stage 2):**
- **Total volume change %** = $(\text{total units}_{\text{After}} - \text{total units}_{\text{Before}}) \div \text{total units}_{\text{Before}} \times 100$.
- **Revenue** = $\sum (\text{units\_sold} \times \text{avg\_price})$ across all three products.
- **Variable profit** = $\sum (\text{units\_sold} \times (\text{avg\_price} - \text{unit\_cost}))$ across all three products.
- **Break-even volume loss for Croissant (%)**: Given Croissant's `Before` unit margin $(\$4.00 - \$1.50 = \$2.50)$ and `After` unit margin $(\$4.40 - \$1.50 = \$2.90)$, the maximum percentage drop in Croissant units that still leaves Croissant variable profit unchanged is $(1 - \frac{2.50}{2.90}) \times 100$, expressed as a negative percentage (e.g. `-13.79`).
  $brief$,

  '/data/bakery_pricing.csv',

  '[
    {"id":"vol_change_pct", "label":"Total unit volume change, Before to After",        "unit":"%"},
    {"id":"rev_before",     "label":"Total revenue Before",                             "unit":"$"},
    {"id":"rev_after",      "label":"Total revenue After",                              "unit":"$"},
    {"id":"profit_before",  "label":"Total variable profit Before",                     "unit":"$"},
    {"id":"profit_after",   "label":"Total variable profit After",                      "unit":"$"},
    {"id":"breakeven_loss", "label":"Break-even volume loss for Croissant (+10% price)","unit":"%"}
  ]'::jsonb,

  '{
    "max_score": 10,
    "criteria": [
      {"id":"mece","weight":3,
       "check":"Top-level branches are MECE and separate price/unit-margin gain from volume/elasticity loss across the product line."},
      {"id":"coverage","weight":3,
       "check":"Covers all three products (Croissant, Sourdough loaf, Cinnamon roll) and compares observed volume loss against the break-even volume loss threshold."},
      {"id":"prioritization","weight":2,
       "check":"Prioritizes products by profit impact or price sensitivity (identifying Cinnamon roll and Croissant as elastic, Sourdough as inelastic)."},
      {"id":"hypotheses","weight":2,
       "check":"States testable hypotheses tied to CSV columns (units_sold, avg_price, unit_cost) and product-level variable profit."}
    ],
    "known_drivers": ["Sourdough volume fell only 5% so profit rose","Croissant volume fell 15% vs 13.79% break-even so profit fell slightly","Cinnamon roll volume fell 20% vs 14.29% break-even so profit fell sharply"],
    "common_failures": ["treats all three products identically","looks only at revenue instead of variable profit","ignores break-even elasticity math"]
  }'::jsonb,

  '{
    "max_score": 10,
    "criteria": [
      {"id":"answer_first","weight":2,
       "check":"First sentence states clearly that the blanket 10% price hike hurt total variable profit (-$95) and recommends a differentiated pricing action by product."},
      {"id":"diagnosis","weight":3,
       "check":"Shows that total revenue fell ($20,000 to $19,030) and total variable profit fell ($12,100 to $12,005) because Cinnamon roll (-20% volume, profit -$240) and Croissant (-15% volume vs -13.79% break-even, profit -$70) lost more volume than their break-even thresholds, whereas Sourdough (-5% volume, profit +$215) gained profit."},
      {"id":"recommendation","weight":2,
       "check":"Recommends keeping the $6.60 price on Sourdough while rolling back or moderating the price hike (or bundling) on Cinnamon rolls and Croissants with specific numbers."},
      {"id":"risks","weight":1.5,
       "check":"Identifies a concrete risk (e.g. customer confusion from selective price rollbacks or cannibalization) and how to mitigate it."},
      {"id":"next_step","weight":1.5,
       "check":"Defines a measurable follow-up experiment with target unit volumes and timeframe."}
    ],
    "reference_facts": {
      "vol_change_pct": -14.44,
      "rev_before": 20000, "rev_after": 19030,
      "profit_before": 12100, "profit_after": 12005,
      "breakeven_loss_croissant_pct": -13.79,
      "croissant_profit": {"before": 5000, "after": 4930},
      "sourdough_profit": {"before": 3500, "after": 3715},
      "cinnamon_profit": {"before": 3600, "after": 3360}
    }
  }'::jsonb
);
