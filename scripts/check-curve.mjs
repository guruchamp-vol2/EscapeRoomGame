// Verifies the difficulty curve: every generated level must score higher than
// the one before it, and consecutive levels should share few rooms.
import { generatedPlans } from '../src/levels/gen/plan.js';
const plans = generatedPlans();
let bad = 0;
for (let i = 1; i < plans.length; i++) {
  const a = plans[i - 1], b = plans[i];
  if (!(b.score > a.score) || b.load < a.load) { bad++; console.log('NOT HARDER', a.number, a.score.toFixed(2), '→', b.number, b.score.toFixed(2)); }
}
for (const n of [5, 6, 7, 8, 29, 30, 31, 55, 105, 205, 330, 480, 504]) {
  const p = plans.find((x) => x.number === n);
  console.log(String(n).padStart(3), 'score', p.score.toFixed(2).padStart(6), 'load', String(p.load).padStart(4), 'diff', p.diff.toFixed(3), p.modules.join(', '), p.twists.join(','));
}
let shared = 0;
for (let i = 1; i < plans.length; i++) shared += plans[i].modules.filter((m) => plans[i - 1].modules.includes(m)).length / plans[i].modules.length;
const sigs = new Set(plans.map((p) => p.modules.join('+')));
console.log(`violations: ${bad}  avg rooms shared with previous level: ${(100 * shared / (plans.length - 1)).toFixed(0)}%  distinct room combos: ${sigs.size}/${plans.length}`);
process.exit(bad ? 1 : 0);
