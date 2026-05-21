import { createClient } from '@supabase/supabase-js';
const url = 'https://jvugbcrxwhkfkffolbgm.supabase.co';
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2dWdiY3J4d2hrZmtmZm9sYmdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNzA1MDcsImV4cCI6MjA5NDY0NjUwN30.vV6gizf-HVxKppL4eM0l04wJyy9J73yAFSNpuu3QbkQ';
const sb = createClient(url, anon);
let pass=0, fail=0;
const check=(n,ok,d)=>{ok?(console.log(`✅ ${n}`),pass++):(console.log(`❌ ${n} — ${d}`),fail++);};

const sel = await sb.from('chat_messages').select('*').limit(5);
check('Guest cannot READ', sel.error || (sel.data?.length===0), `rows=${sel.data?.length}`);
console.log('  ', sel.error?.message ?? `rows=${sel.data.length}`);

const ins = await sb.from('chat_messages').insert({user_id:'00000000-0000-0000-0000-000000000000',content:'hack'}).select();
check('Guest cannot SEND', !!ins.error, `inserted: ${JSON.stringify(ins.data)}`);
console.log('  ', ins.error?.message ?? 'INSERT OK (bad)');

const del = await sb.from('chat_messages').delete().neq('id','00000000-0000-0000-0000-000000000000').select();
check('Guest cannot DELETE', del.error || (del.data?.length===0), `deleted: ${JSON.stringify(del.data)}`);
console.log('  ', del.error?.message ?? `deleted=${del.data?.length}`);

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail?1:0);
