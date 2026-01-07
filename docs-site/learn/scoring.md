# How Scoring Works

Ever wonder how points are calculated? Here's the complete breakdown.

## The Scoring Formula

**Points = Base + Participation + PR Bonus**

Let's break each part down.

## Base Points: The Competitive Part

Base points = **Number of people you beat** (plus 1 for showing up)

### Example: 4 Competitors

```
Rank  Name    Time      People Beat  Base Points
1     Alice   14:32     3            3
2     Bob     15:08     2            2
3     Carol   16:45     1            1
4     Dave    17:20     0            0
```

- **Alice** beat 3 people → 3 base points
- **Bob** beat 2 people → 2 base points
- **Carol** beat 1 person → 1 base point
- **Dave** beat nobody → 0 base points

**Why this matters:** Even if you're not the fastest, you earn points for beating others. Finishing 3rd out of 4 is worth 1 point!

## Participation Bonus: +1 for Showing Up

If you complete the event (have a qualifying activity), you get **+1 point** automatically.

### Example

| Rank | Name  | Base | Participation | Total |
|------|-------|------|----------------|-------|
| 1    | Alice | 3    | +1             | 4     |
| 2    | Bob   | 2    | +1             | 3     |
| 3    | Carol | 1    | +1             | 2     |
| 4    | Dave  | 0    | +1             | 1     |
| —    | Eve   | —    | 0 (no ride)    | 0     |

Eve didn't ride, so she gets 0 points total. Everyone else gets at least 1 point for participating.

**Why:** We want to reward effort and participation, not just podium finishes.

## PR Bonus: +1 for Personal Records

If your time is faster than your previous best on that segment, you get **+1 bonus point**.

### Example

```
Rank  Name    Base  Participation  PR?  PR Bonus  Total
1     Alice   3     +1             ✓    +1        5
2     Bob     2     +1             ✗    0         3
3     Carol   1     +1             ✓    +1        3
4     Dave    0     +1             ✗    0         1
```

- **Alice** beat everyone AND set a PR → 3 + 1 + 1 = **5 points**
- **Bob** beat two people but no PR → 2 + 1 + 0 = **3 points**
- **Carol** beat one person AND set a PR → 1 + 1 + 1 = **3 points**
- **Dave** beat nobody and no PR → 0 + 1 + 0 = **1 point**

Notice: Carol beat only one person but tied Bob in points because of her PR!

## Putting It Together

**Total Weekly Points = Base + Participation + PR Bonus**

### Complete Example (5 Competitors)

Imagine an event with 5 people riding "Lookout Mountain":

| Rank | Name   | Time   | Base | Particip. | PR? | PR Bonus | Total |
|------|--------|--------|------|-----------|-----|----------|-------|
| 1    | Alice  | 14:32  | 4    | 1         | ✓   | 1        | **6** |
| 2    | Bob    | 15:08  | 3    | 1         | ✗   | 0        | **4** |
| 3    | Carol  | 16:45  | 2    | 1         | ✓   | 1        | **4** |
| 4    | Dave   | 17:20  | 1    | 1         | ✗   | 0        | **2** |
| 5    | Eve    | 18:00  | 0    | 1         | ✓   | 1        | **2** |

**Alice wins the week with 6 points!**

Interesting: Carol and Eve tie with 4 and 2 points respectively because of their PRs, even though they didn't place as high.

## Season Points

**Season Total = Sum of all weekly points**

After 4 weeks with the above scoring:

```
Alice: 6 + 5 + 6 + 4 = 21 points (WINS SEASON!)
Carol: 4 + 3 + 5 + 3 = 15 points
Bob:   4 + 4 + 3 + 2 = 13 points
Eve:   2 + 2 + 2 + 4 = 10 points
Dave:  2 + 1 + 2 + 1 = 6 points
```

The person with the most total points wins the season.

## Special Case: Multipliers

Some weeks may have a **multiplier** to make them more valuable (e.g., finals).

**Total with Multiplier = (Base + Participation + PR Bonus) × Multiplier**

### Example: Finals Week with 2× Multiplier

Same 5 people, but the finals have a 2× multiplier:

| Rank | Name   | Base | Particip. | PR Bonus | Subtotal | Multiplier | Total |
|------|--------|------|-----------|----------|----------|------------|-------|
| 1    | Alice  | 4    | 1         | 1        | 6        | ×2         | **12**|
| 2    | Bob    | 3    | 1         | 0        | 4        | ×2         | **8** |
| 3    | Carol  | 2    | 1         | 1        | 4        | ×2         | **8** |

Alice gets **12 points** in the finals (double) instead of 6!

This makes finals worth playing hard for.

## Frequently Asked Questions

**Q: Can points be negative?**
A: No. Minimum is 0 (if you don't ride). Everyone who participates gets at least 1.

**Q: What if 2 people tie in time?**
A: They share the same rank. Both would be "1st" with the same points.

**Q: Can I lose points?**
A: No. Points only accumulate. Bad weeks don't subtract from your season total.

**Q: Is there a maximum points per week?**
A: Technically unlimited, but with N competitors, the max is:
- Base: N-1 (beat everyone)
- Participation: 1
- PR Bonus: 1
- **Max = N + 1**

So with 10 competitors, the max per week is **11 points**.

**Q: What about weekly multipliers?**
A: If a week has a 2× multiplier, max = (N + 1) × 2

**Q: Can a participant earn the PR bonus twice?**
A: Not in the same week. You get 1 PR bonus per week max, even if you set multiple PRs.

## Why This Scoring System?

This system rewards:

✅ **Performance** - Beat others, earn points (base)
✅ **Participation** - Show up and ride (participation bonus)
✅ **Improvement** - Get faster over time (PR bonus)
✅ **Consistency** - Accumulate points across the season

It discourages:
❌ **No-shows** - Miss an event, get 0 that week
❌ **Sandbagging** - You can't hide; your best time is visible
❌ **Gaming** - All calculations are automatic and transparent

## Technical Note: Computation Timing

**Scores are computed fresh every time the leaderboard is viewed.** This means:
- If data changes, scores recalculate automatically
- If a participant deletes their data, remaining scores adjust
- Historical results stay accurate

This is different from storing scores in a database. We calculate on-the-fly, ensuring fairness.

---

**Next:** [Learn About the Project →](/learn/about)
