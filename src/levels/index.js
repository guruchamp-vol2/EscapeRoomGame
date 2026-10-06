import { LEVELS, GROUPS, levelMeta, DAILY_ID } from './meta.js';
import { THEMES } from './builder.js';
import { worldTheme } from './gen/theme.js';
import { buildGenerated } from './gen/generate.js';
import * as scale from './scale.js';
import * as gateway from './gateway.js';
import * as loop from './loop.js';
import * as lab from './lab.js';

const STORY = { scale, gateway, loop, lab };

export { LEVELS, GROUPS, levelMeta, DAILY_ID };

// Materials, colours and lighting for a level.
export const themeFor = (meta) => (meta.plan ? worldTheme(meta.plan) : THEMES[meta.id]);

export const buildLevel = (meta, builder, ctx) =>
  meta.plan ? buildGenerated(meta.plan, builder, ctx) : STORY[meta.id].build(builder, ctx);
