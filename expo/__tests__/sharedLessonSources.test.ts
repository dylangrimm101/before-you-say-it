import {test,expect} from 'bun:test';
test('actual native builder through shared source gate, repair and durable consumer (offline)',()=>{
 const p=Bun.spawnSync(['bun','__tests__/sharedLessonSources.fixture.ts'],{cwd:import.meta.dir+'/..',env:process.env});
 expect(p.exitCode,new TextDecoder().decode(p.stderr)+new TextDecoder().decode(p.stdout)).toBe(0);
});
