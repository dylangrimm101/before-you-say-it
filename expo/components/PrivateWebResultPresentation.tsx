import React from "react";
import { restorePrivateWebResult } from "@/lib/privateWebResult";

/**
 * Staged result-only renderer. Supply native View/Text (or test host elements).
 * The caller must first obtain the record through an authenticated ownership-scoped
 * private read. This component neither authenticates nor fetches/persists data.
 * Never pass result JSON in navigation params or turn it into a practice session.
 */
export function PrivateWebResultPresentation({ record, Container, Text }: {
  record: unknown;
  Container: React.ElementType;
  Text: React.ElementType;
}): React.JSX.Element {
  let restored;
  try { restored = restorePrivateWebResult(record); }
  catch { return <Container><Text>Saved result unavailable</Text></Container>; }
  const { pressure_moment: pm, practice_shift: ps, starting_index: idx, recommended_path: path } = restored.result;
  return <Container>
    <Text>Saved web result</Text>
    <Text>Transcript and rewrite are not included in this saved result.</Text>
    <Container>
      <Text>{pm.headline}</Text>
      <Text>{pm.conclusion}</Text>
      <Text>How BYSI read this</Text>
      <Text>{pm.how_bysi_read_this.observed}</Text>
      <Text>{pm.how_bysi_read_this.why_it_matters}</Text>
      <Text>{pm.how_bysi_read_this.confidence}</Text>
    </Container>
    <Container>
      <Text>{ps.headline}</Text>
      <Text>Current pattern</Text>
      {ps.current_pattern.map((line, i) => <Text key={`current-${i}`}>{line}</Text>)}
      <Text>Practice target</Text>
      {ps.practice_target.map((line, i) => <Text key={`target-${i}`}>{line}</Text>)}
      <Text>{ps.goal_line}</Text>
      <Text>{ps.honesty_note}</Text>
    </Container>
    <Container>
      <Text>{idx.label}</Text>
      <Text>{idx.overall === null ? "Not scored" : String(idx.overall)}</Text>
      <Text>{idx.coverage_note}</Text>
      <Text>{idx.score_note}</Text>
      <Text>Focus</Text><Text>{idx.focus_dimension}</Text>
      <Text>Observed dimensions</Text>
      {idx.observed_dimensions.map(row => <Container key={row.name}>
        <Text>{row.name}</Text><Text>{row.score === null ? "Not scored" : String(row.score)}</Text><Text>{row.evidence}</Text>
      </Container>)}
      <Text>Unobserved dimensions</Text>
      {idx.unobserved_dimensions.map(name => <Text key={name}>{name}</Text>)}
    </Container>
    <Container>
      <Text>Recommended path</Text>
      <Text>{path.first_module}</Text><Text>{path.reason}</Text>
      {path.next_modules.map((name, i) => <Text key={`module-${i}`}>{name}</Text>)}
    </Container>
  </Container>;
}
