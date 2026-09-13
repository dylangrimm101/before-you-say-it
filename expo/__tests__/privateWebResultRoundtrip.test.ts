import { test, expect } from 'bun:test';
import { restorePrivateWebResult } from '../lib/privateWebResult';
import { PrivateWebResultPresentation } from '../components/PrivateWebResultPresentation';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Synthetic provider responses through the actual producer, not live evidence.
const web = process.env.BYSI_WEB_ROOT || resolve(import.meta.dir, '../../../Projects/bysi-web-claude-parity');
const routeURL = pathToFileURL(`${web}/app/api/generate/route.js`);
const source = (await Bun.file(routeURL).text()).replace(/from ['"](\.[^'"]+)['"]/g, (_match, specifier) => `from ${JSON.stringify(new URL(specifier, routeURL).href)}`);
const { produceFreeRehearsalResult } = await import(`data:text/javascript;base64,${Buffer.from(source + '\nexport { produceFreeRehearsalResult };').toString('base64')}`);
const { encodeResult, decodeResult } = await import(`${web}/app/api/_result-bridge/codec.mjs`);

test('producer → v1 codec → JSON → native preserves null, zero and fractional observations', async () => {
  const input = { contract: { entry_route: 'A', context: 'Work', scenario: 'Scope changes', success_target: 'Make a request', pressure_condition: 'They disagree' }, transcript: { user_turn_1: 'Can we choose one task?', counterpart_pushback: 'Everything matters.', user_turn_2: 'Which one comes first?' } };
  const raw = {
    mode: 'result',
    pressure_moment: { headline: 'You asked for a task.', ask_quote: input.transcript.user_turn_1, pushback_quote: input.transcript.counterpart_pushback, response_quote: input.transcript.user_turn_2, conclusion: 'You asked again. The question stayed open.', how_bysi_read_this: { observed: 'You named a choice.', why_it_matters: 'A choice can be answered.', confidence: 'One exchange only.' } },
    practice_shift: { headline: 'Practice choosing.', current_pattern: ['Ask', 'Pressure', 'Ask again'], practice_target: ['Ask', 'Pressure', 'Name a task'], goal_line: 'One task', honesty_note: 'A target, not an achievement.' },
    starting_index: { overall: null, label: 'Partial index', coverage_note: '1 of 6 signals observed', observed_dimensions: [{ name: 'Clarity', score: null as number | null | undefined, evidence: 'The question was easy to follow.' }], unobserved_dimensions: ['Specificity', 'Listening', 'Steadiness', 'Boundaries', 'Repair'], focus_dimension: 'Clarity', score_note: 'Observed signals only.' },
    recommended_path: { first_module: 'Make a Clear Ask', reason: 'Practice naming the task.', next_modules: ['Listen and Respond'] }
  };
  const previous = global.fetch;
  try {
    for (const score of [undefined, null, 0, 49.25, 100]) {
      raw.starting_index.observed_dimensions[0].score = score;
      global.fetch = (async () => Response.json({ id: 'msg_synthetic', model: 'synthetic-model', content: [{ type: 'text', text: JSON.stringify(raw) }] })) as typeof fetch;
      const produced = await produceFreeRehearsalResult(input, 'synthetic-key');
      expect(produced.status).toBe(200);
      expect(produced.provenance.rehearsal_id).toBeNull();
      // Test-only ownership binding; no authenticated capture or native activation.
      const record = encodeResult(produced.result, { ...produced.provenance, rehearsal_id: 'synthetic-owned-rehearsal' });
      const wire = JSON.stringify(record);
      expect(decodeResult(wire)).toEqual(record);
      const restored = restorePrivateWebResult(wire);
      expect(restored).toEqual(record);
      expect(restored.result.starting_index.observed_dimensions[0].score).toBe(score ?? null);
      const html = renderToStaticMarkup(React.createElement(PrivateWebResultPresentation, { record: restored, Container: 'section', Text: 'p' }));
      expect(html).toContain(score == null ? '<p>Not scored</p><p>The question' : `<p>${score}</p><p>The question`);
      expect(html).not.toContain('>null<');
      expect(wire).not.toContain(input.transcript.user_turn_1);
    }
  } finally { global.fetch = previous; }
});
