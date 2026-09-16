"""Explicit offline mobile gates. Never build/export/deploy or copy private backend into this repo."""
from pathlib import Path
import argparse, os, subprocess, json, time, hashlib, shutil, tempfile, re
ROOT = Path(__file__).resolve().parents[1]
PIN = 'd0a068a1ee849144caf65811f4bf0c457056515a'
p = argparse.ArgumentParser()
p.add_argument('--install', action='store_true')
p.add_argument('--private-source', type=Path, help='Separately authorized private reviewed checkout at the pinned commit')
a = p.parse_args()
env = {k:v for k,v in os.environ.items() if not k.startswith(('BYSI_', 'EXPO_PUBLIC_', 'SUPABASE_', 'ANTHROPIC_', 'OPENAI_', 'ELEVENLABS_', 'STRIPE_', 'REVENUECAT_', 'EAS_', 'EXPO_TOKEN'))}
env.update(EXPO_NO_DOTENV='1', CI='1', BYSI_COMPONENT_TEST_DEPS=str(ROOT/'component-deps'))
out = ROOT/'handoff-local-results'/str(time.time_ns()); out.mkdir(parents=True)
results=[]
def run(name,cmd,cwd):
    log=out/(name+'.log'); start=time.time()
    with log.open('w') as f:
        try: code=subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT,timeout=600).returncode
        except subprocess.TimeoutExpired: code=124
    text=log.read_text(); totals=re.findall(r'^\s*(\d+) (pass|fail|expect\(\) calls)',text,re.M)
    row=dict(name=name,command=cmd,exit=code,seconds=round(time.time()-start,2),counts=totals,log_sha256=hashlib.sha256(log.read_bytes()).hexdigest())
    results.append(row);(out/'results.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(row),flush=True)
    return code
if a.install:
    for name,cmd in [('locked-install',['bun','install','--frozen-lockfile','--ignore-scripts']),('renderer-install',['bun','scripts/component-test-deps.ts','--install'])]:
        if run(name,cmd,ROOT/'expo'):raise SystemExit('Dependency setup failed; inspect local log')
standalone=['nativeAuth','normalFreeRecovery','normalFreeSession','normalResultsReturnPolicy','normalResultsConfig','dictationAbort','dictationFailure','nativeTalkingCompatibility','nativeSpeechBytes','testflightReleaseConfig','phaseRecovery','boundedRecordingRecovery','approvedContinuation','freeJournalStorage','approvedLessonDecks','approvedLessonJourneys','approvedRehearsals','bundledApprovedDeckOffline','clientEnvGuard','purchasesIdentity','privacyPersistence']
run('standalone-mobile',['bun','test',*[f'__tests__/{n}.test.ts' for n in standalone]],ROOT/'expo')
run('typecheck',['bun','node_modules/typescript/bin/tsc','--noEmit'],ROOT/'expo')
run('canonical-check',['bun','run','check'],ROOT/'expo')
if a.private_source:
    source=a.private_source.resolve()
    if subprocess.check_output(['git','-C',str(source),'rev-parse','HEAD'],text=True).strip()!=PIN:raise SystemExit('Wrong private source pin')
    if subprocess.check_output(['git','-C',str(source),'status','--porcelain'],text=True).strip():raise SystemExit('Private source must be clean')
    for required in ['server/server/native-free/routes.mjs', 'server/node_modules/next/server.js', 'server/node_modules/pg/package.json', 'test-deps/node_modules/@electric-sql/pglite/package.json']:
        if not (source/required).is_file():raise SystemExit('Prepare private reviewed dependencies separately: '+required)
    # Composition lives OUTSIDE the mobile repo. Symlinks expose private modules locally only.
    scratch=Path(tempfile.mkdtemp(prefix='bysi-mobile-composed-'))
    shutil.copytree(ROOT/'expo',scratch/'expo',ignore=shutil.ignore_patterns('node_modules','.expo','expo-env.d.ts','dist','web-build','*.log'))
    for path in (scratch/'expo').rglob('*'):
        if path.is_file():assert path.read_bytes()==(ROOT/'expo'/path.relative_to(scratch/'expo')).read_bytes()
    for name,target in [('server',source/'server'),('test-deps',source/'test-deps'),('component-deps',ROOT/'component-deps'),('expo/node_modules',ROOT/'expo/node_modules')]:
        (scratch/name).symlink_to(target,target_is_directory=True)
    env['BYSI_TEST_DEPS']=str(source/'test-deps')
    # Each suite runs in its own process; no leaked module mocks or weakened assertions.
    for name in ['frontDoorAcceptance','contextRecoveryMounted','composedReturnRepair','normalFreeMountedColdResume','approvedContinuationMounted','savedResultMountedHistory']:
        run('composed-'+name,['bun','test',f'__tests__/{name}.test.ts'],scratch/'expo')
    (out/'composition.json').write_text(json.dumps({'scratch':str(scratch),'private_pin':PIN,'mobile_bytes':'exact copied source; no fixture/assertion edits','seams':'local PGlite; modeled Auth/provider transport, recorder/player/storage/navigation primitives; no real providers or device'},indent=2)+'\n')
    assert not subprocess.check_output(['git','-C',str(source),'status','--porcelain'],text=True).strip()
print('Local logs:',out)
raise SystemExit(1 if any(r['exit'] for r in results) else 0)
