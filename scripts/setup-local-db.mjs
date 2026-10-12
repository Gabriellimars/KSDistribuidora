import {writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const config={name:'ks-distribuidora-local',compatibility_date:'2026-05-15',d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000',migrations_dir:'drizzle'}]};
writeFileSync('wrangler-local.json',JSON.stringify(config,null,2));
const result=spawnSync(process.execPath,[fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js',import.meta.url)),'d1','migrations','apply','site-creator-d1','--local','--config','wrangler-local.json','--persist-to','.wrangler/state'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
