insert into public.challenges
  (id, title, brief_md, csv_url, stage2_questions, rubric_structure, rubric_memo)
values (
  '11111111-1111-4111-8111-111111111111',
  'Brew & Co.: Why did our margin fall?',

  $brief$
## Brew & Co., a neighbourhood coffee shop

The owner writes:

> "Our margin fell a lot between Q1 and Q2. In Q2 I switched to oat milk as the default for lattes, changed my drip coffee supplier, and launched a loyalty discount. Sales volume looks fine, but I'm making less on each dollar. What hurt us most, and what should I do?"

**Data:** `brew_co.csv`
- `avg_price` is the average price actually paid, after discounts.
- `unit_cost` is all variable cost per item (ingredients, packaging, per-item labor).

**Definition:** Variable margin = (revenue − variable cost) ÷ revenue, across all products.

**Method for the driver split (Stage 2):** Start from Q1.
- Step A: apply Q2 unit volumes with Q1 prices and Q1 unit costs. This isolates **mix**.
- Step B: also apply Q2 prices. This adds the **price** effect.
- Step C: also apply Q2 unit costs. This adds the **cost** effect.

Each effect is the change in total variable margin at that step, in percentage points. The three effects add up to the total change.
  $brief$,

  '/data/brew_co.csv',

  '[
    {"id":"q1_margin",   "label":"Q1 variable margin",                    "unit":"%"},
    {"id":"q2_margin",   "label":"Q2 variable margin",                    "unit":"%"},
    {"id":"rev_change",  "label":"Revenue change, Q1 to Q2",              "unit":"%"},
    {"id":"mix_effect",  "label":"Mix effect on margin (Step A)",         "unit":"pp"},
    {"id":"price_effect","label":"Price effect on margin (Step B)",       "unit":"pp"},
    {"id":"cost_effect", "label":"Cost effect on margin (Step C)",        "unit":"pp"}
  ]'::jsonb,

  '{
    "max_score": 10,
    "criteria": [
      {"id":"mece","weight":3,
       "check":"Top-level branches do not overlap and together cover why variable margin fell (price, mix/volume, unit cost)."},
      {"id":"coverage","weight":3,
       "check":"Names the three owner-mentioned changes as sub-branches: loyalty discount (price), oat milk (cost), supplier change (cost). Bonus for noting that total volume alone does not change margin %, only mix does."},
      {"id":"prioritization","weight":2,
       "check":"Ranks branches by likely size and says which to test first, rather than listing them flat."},
      {"id":"hypotheses","weight":2,
       "check":"States testable hypotheses tied to specific data columns (e.g. latte unit_cost rose; avg_price fell below list)."}
    ],
    "known_drivers": ["loyalty discount lowered average price","oat milk raised latte unit cost","drip supplier change affected drip price/cost","mix shifted toward lower-margin lattes"],
    "common_failures": ["lists symptoms without structure","treats volume as a margin driver","mixes revenue and margin causes in one branch","no prioritization"]
  }'::jsonb,

  '{
    "max_score": 10,
    "criteria": [
      {"id":"answer_first","weight":2,
       "check":"First sentence states the conclusion and recommendation, not background."},
      {"id":"diagnosis","weight":3,
       "check":"Identifies the latte as the problem product and that price and cost effects are roughly equal, with mix minor. Penalize claims that contradict the reference facts."},
      {"id":"recommendation","weight":2,
       "check":"At least one specific action with a number or rule (e.g. cap the discount, add an oat surcharge, renegotiate supplier)."},
      {"id":"risks","weight":1.5,
       "check":"Names a real risk of the recommendation (e.g. volume loss on lattes) and how to monitor it."},
      {"id":"next_step","weight":1.5,
       "check":"Gives a measurable follow-up (metric, time frame)."}
    ],
    "reference_facts": {
      "q1_margin_pct": 22.52, "q2_margin_pct": 15.38,
      "mix_pp": -0.60, "price_pp": -3.29, "cost_pp": -3.25,
      "latte_margin_pct": {"q1": 20.0, "q2": 9.47},
      "drip_margin_pct": {"q1": 20.0, "q2": 15.79},
      "pastry_margin_pct": {"q1": 30.0, "q2": 30.0}
    }
  }'::jsonb
);
