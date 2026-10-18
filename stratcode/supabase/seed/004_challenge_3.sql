insert into public.challenges
  (id, title, brief_md, csv_url, stage2_questions, rubric_structure, rubric_memo)
values (
  '33333333-3333-4333-8333-333333333333',
  'Pressed & Proper: Should we open a second location?',

  $brief$
## Pressed & Proper, a fast-casual sandwich & juice shop

The owner writes:

> "Our Downtown shop has been Consistently profitable at 250 customers a day. A broker just offered me a prime Westside space for $7,200/month with $108,000 in upfront buildout costs. I estimate Westside will draw 150 customers a day at the same $12 average order and $4 ingredient cost—though about 25 of those daily customers will likely be regulars switching over from our Downtown shop. Should we sign the lease and open Location 2?"

**Data:** `shop_expansion.csv`
- Assume a standard **30-day month** for all daily/monthly conversions (`monthly_lease / 30` = daily lease cost; `daily * 30` = monthly).
- `est_cannibalized_daily_customers` is the number of Location 2's projected daily customers who would otherwise have purchased at Location 1 (Downtown).

**Definitions & Method (Stage 2):**
- **Contribution margin per customer** = $\text{avg\_order\_value} - \text{variable\_cost\_per\_order}$.
- **Location 2 contribution margin per day** = $\text{Location 2 daily\_customers} \times \text{contribution margin per customer}$.
- **Location 2 daily fixed cost** = $\text{daily\_fixed\_labor} + (\text{monthly\_lease} \div 30)$.
- **Location 2 break-even customers per day (standalone)** = $\text{Location 2 daily fixed cost} \div \text{contribution margin per customer}$.
- **Location 2 standalone monthly operating profit** = $(\text{Location 2 contribution margin per day} - \text{Location 2 daily fixed cost}) \times 30$.
- **Standalone payback period (months)** = $\text{upfront\_buildout} \div \text{Location 2 standalone monthly operating profit}$.
- **Cannibalization-adjusted payback period (months)** = $\text{upfront\_buildout} \div (\text{Location 2 standalone monthly operating profit} - \text{monthly contribution margin lost at Location 1})$.
  $brief$,

  '/data/shop_expansion.csv',

  '[
    {"id":"cm_per_customer",    "label":"Contribution margin per customer",                          "unit":"$"},
    {"id":"loc2_cm_per_day",    "label":"Location 2 contribution margin per day (standalone)",       "unit":"$"},
    {"id":"loc2_breakeven_cust","label":"Location 2 break-even customers per day (standalone)",      "unit":"customers"},
    {"id":"loc2_monthly_profit","label":"Location 2 standalone monthly operating profit (30 days)",  "unit":"$"},
    {"id":"payback_standalone", "label":"Standalone payback period on buildout",                     "unit":"months"},
    {"id":"payback_net",        "label":"Cannibalization-adjusted payback period on buildout",       "unit":"months"}
  ]'::jsonb,

  '{
    "max_score": 10,
    "criteria": [
      {"id":"mece","weight":3,
       "check":"Top-level branches are MECE and separate standalone unit/store economics (contribution margin vs. fixed labor and lease) from network/portfolio effects (Location 1 cannibalization and upfront capital payback)."},
      {"id":"coverage","weight":3,
       "check":"Covers Location 2 daily contribution margin ($1,200), daily fixed costs ($800), standalone break-even (100 customers/day), cannibalization impact (25 customers/day = $200/day or $6,000/month lost at Location 1), and payback period (9 months standalone vs. 18 months net)."},
      {"id":"prioritization","weight":2,
       "check":"Prioritizes net incremental cash flow and cannibalization-adjusted break-even (125 customers/day) over standalone top-line projections."},
      {"id":"hypotheses","weight":2,
       "check":"States concrete, falsifiable hypotheses linked to CSV metrics (daily_customers, monthly_lease, upfront_buildout, est_cannibalized_daily_customers)."}
    ],
    "known_drivers": ["Standalone Location 2 earns $400/day ($12,000/month) with a 9-month payback","Cannibalizing 25 customers/day from Location 1 costs $200/day ($6,000/month) in lost margin","Net incremental profit is $6,000/month, doubling payback to 18 months and raising effective break-even from 100 to 125 customers/day"],
    "common_failures": ["ignores cannibalization of Location 1 customers","forgets to convert monthly_lease to daily (or daily labor to monthly) on a consistent 30-day basis","looks only at standalone payback without checking cushion above network break-even"]
  }'::jsonb,

  '{
    "max_score": 10,
    "criteria": [
      {"id":"answer_first","weight":2,
       "check":"First sentence gives a clear, conditional recommendation on opening Location 2 backed by the 18-month net payback (vs. 9-month standalone) and $6,000/month net incremental profit."},
      {"id":"diagnosis","weight":3,
       "check":"Quantifies both standalone economics ($8/customer CM, $1,200/day CM vs. $800/day fixed cost, 100 customers/day break-even, $12,000/month profit, 9-month payback) and cannibalization impact (25 daily customers = $6,000/month lost at Location 1, cutting net profit to $6,000/month, raising effective break-even to 125 customers/day, and extending payback to 18 months)."},
      {"id":"recommendation","weight":2,
       "check":"Recommends concrete deal or operating levers to improve payback (e.g., negotiating landlord tenant-improvement allowance on the $108,000 buildout, reducing the $7,200/month lease, or limiting Downtown cannibalization)."},
      {"id":"risks","weight":1.5,
       "check":"Identifies the thin margin of safety: at 125 network break-even customers/day, a drop of more than 25 daily customers (16.7% below the 150 projection) makes the expansion value-destructive."},
      {"id":"next_step","weight":1.5,
       "check":"Proposes a concrete pre-lease validation step or milestone (e.g., zip-code check on Downtown loyalty data, pop-up demand test, or lease counter-offer target) with numeric thresholds."}
    ],
    "reference_facts": {
      "cm_per_customer": 8,
      "loc1_cm_per_day": 2000,
      "loc1_daily_fixed_cost": 800,
      "loc1_monthly_profit": 36000,
      "loc2_cm_per_day": 1200,
      "loc2_daily_fixed_cost": 800,
      "loc2_breakeven_cust_standalone": 100,
      "loc2_breakeven_cust_net": 125,
      "loc2_monthly_profit_standalone": 12000,
      "cannibalization_monthly_loss": 6000,
      "net_incremental_monthly_profit": 6000,
      "upfront_buildout": 108000,
      "payback_standalone_months": 9,
      "payback_net_months": 18
    }
  }'::jsonb
);
