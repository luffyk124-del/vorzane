import { createHash } from 'node:crypto';
import { PrismaClient } from '../backend/node_modules/@prisma/client/index.js';
// Verified source columns: auth.users(id), public.player_saves(user_id, game_state, updated_at).
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
if (args.has('--help')) { console.log('Dry-run by default. --apply requires MIGRATION_BACKUP_APPROVED=YES.'); process.exit(0); }
if (apply && process.env.MIGRATION_BACKUP_APPROVED !== 'YES') throw new Error('Refusing --apply without verified backup approval.');
for (const key of ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','DATABASE_URL']) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
const db = new PrismaClient(), base = process.env.SUPABASE_URL.replace(/\/$/, '');
const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
async function get(path) { const r=await fetch(`${base}${path}`,{headers}); if(!r.ok) throw new Error(`Supabase read failed (HTTP ${r.status})`); return r.json(); }
const digest = state => createHash('sha256').update(JSON.stringify(state)).digest('hex');
async function usersAll() { const out=[]; for(let page=1;page<=100000;page++){const x=await get(`/auth/v1/admin/users?page=${page}&per_page=100`);const batch=Array.isArray(x)?x:x.users;if(!Array.isArray(batch))throw Error('Invalid auth users page');out.push(...batch);if(batch.length<100)return out;} throw Error('Pagination safety limit exceeded'); }
try {
 const [users,saves]=await Promise.all([usersAll(),get('/rest/v1/player_saves?select=user_id,game_state,updated_at&order=user_id.asc')]);
 if(!Array.isArray(saves))throw Error('Invalid player_saves response'); const ids=new Set(users.map(u=>u.id));
 const rows=saves.map(r=>{if(!ids.has(r.user_id)||!r.game_state||typeof r.game_state!=='object'||Array.isArray(r.game_state))throw Error('Preflight invalid owner/state; no writes performed');return {id:r.user_id,state:r.game_state,checksum:digest(r.game_state),updatedAt:r.updated_at?new Date(r.updated_at):new Date()};});
 const conflicts=[]; for(const r of rows){const p=await db.playerSave.findUnique({where:{userId:r.id}}); if(p&&digest(p.state)!==r.checksum)conflicts.push(r.id);if(!p){const u=await db.user.findUnique({where:{id:r.id}});if(u&&!u.isAnonymous)conflicts.push(r.id);}}
 if(conflicts.length)throw Error(`Preflight detected ${conflicts.length} conflicts; no writes performed`);
 console.log(JSON.stringify({mode:apply?'apply':'dry-run',eligibleSaves:rows.length,conflicts:0,source:'unchanged',details:'IDs, emails, and save data omitted'}));
 if(apply)for(const r of rows)await db.$transaction(async tx=>{const prior=await tx.playerSave.findUnique({where:{userId:r.id}});if(prior){if(digest(prior.state)!==r.checksum)throw Error('Target changed after preflight');return;}await tx.user.upsert({where:{id:r.id},create:{id:r.id,isAnonymous:true,role:'PLAYER'},update:{}});await tx.playerSave.create({data:{userId:r.id,version:1,revision:0,state:r.state,updatedAt:r.updatedAt}});await tx.migrationSourceMarker.upsert({where:{sourceUserId:r.id},create:{sourceUserId:r.id,checksum:r.checksum},update:{checksum:r.checksum}});});
 console.log(`Completed ${rows.length} saves (${apply?'apply':'dry-run'}); source unchanged.`);
} finally { await db.$disconnect(); }
