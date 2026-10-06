// Verifies the level plan's structure:
//   * difficulty: every non-boss level scores higher than the non-boss level
//     before it; every boss scores higher than the level just before it
//   * variety: no two neighbouring rooms share a puzzle family
//   * rhythm: a featured mechanic every 7 levels, a boss every 50
import { generatedPlans, MODULES, FAMILY } from '../src/levels/gen/plan.js';
import { isFeatureLevel, isBossLevel } from '../src/levels/gen/storyline.js';

const plans = generatedPlans();
const problems = [];
let chain = null, prev = null;
for (const p of plans) {
  if (p.boss) {
    if (prev && !(p.score > prev.score)) problems.push(`boss ${p.number} (${p.score.toFixed(2)}) not harder than ${prev.number} (${prev.score.toFixed(2)})`);
  } else {
    if (chain && (!(p.score > chain.score) || p.load < chain.load)) problems.push(`${p.number} (${p.score.toFixed(2)}) not harder than ${chain.number} (${chain.score.toFixed(2)})`);
    chain = p;
  }
  p.modules.forEach((m, i) => {
    if (i && FAMILY[m] === FAMILY[p.modules[i - 1]]) problems.push(`${p.number}: ${p.modules[i - 1]} next to ${m} (both ${FAMILY[m]})`);
  });
  if (isFeatureLevel(p.number) && !isBossLevel(p.number) && !p.featured) problems.push(`${p.number}: feature level without a featured mechanic`);
  if (p.featured && !p.modules.includes(p.featured)) problems.push(`${p.number}: featured ${p.featured} missing from the level`);
  if (isBossLevel(p.number) && !p.boss) problems.push(`${p.number}: should be a boss level`);
  prev = p;
}

for (const n of [5, 6, 12, 49, 50, 51, 100, 205, 313, 400, 480, 500, 504]) {
  const p = plans.find((x) => x.number === n);
  console.log(String(n).padStart(3), 'score', p.score.toFixed(2).padStart(6), 'load', String(p.load).padStart(4), p.pulse.padEnd(11),
    (p.boss ? `BOSS ${p.boss.name}` : p.featured ? `featured ${p.featured}` : '').padEnd(34), p.modules.join(', '), p.twists.join(','));
}
const own = (p) => p.modules.filter((m) => !MODULES[m].staple);
let shared = 0;
for (let i = 1; i < plans.length; i++) shared += own(plans[i]).filter((m) => own(plans[i - 1]).includes(m)).length / own(plans[i]).length;
const famCounts = plans.map((p) => new Set(p.modules.map((m) => FAMILY[m])).size / p.modules.length);
console.log(`levels: ${plans.length}  bosses: ${plans.filter((p) => p.boss).length}  featured: ${plans.filter((p) => p.featured).length}`);
console.log(`rooms shared with previous level: ${(100 * shared / (plans.length - 1)).toFixed(0)}%  distinct families per room: ${(100 * famCounts.reduce((a, b) => a + b) / plans.length).toFixed(0)}%  distinct combos: ${new Set(plans.map((p) => p.modules.join('+'))).size}/${plans.length}`);
console.log(problems.length ? `PROBLEMS (${problems.length}):\n  ${problems.slice(0, 20).join('\n  ')}` : 'all checks pass');
process.exit(problems.length ? 1 : 0);
