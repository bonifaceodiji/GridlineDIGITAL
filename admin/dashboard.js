
const SUPABASE_URL="https://kpjpbovphdatqmfifxes.supabase.co",SUPABASE_ANON_KEY="sb_publishable_-KR_19JIiGRRRRSrvzEf_g_mlH6cwNy";
const $=id=>document.getElementById(id);let client;
function showError(message){$('notice').textContent=message;$('notice').classList.add('show')}
function hideError(){$('notice').classList.remove('show')}
function safe(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function date(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.valueOf())?'—':d.toLocaleDateString()}
async function boot(){if(SUPABASE_URL.startsWith('YOUR_')||SUPABASE_ANON_KEY.startsWith('YOUR_')){showError('Add your Supabase project URL and publishable key to both login.html and dashboard.html before use.');return}
client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const {data:{session},error}=await client.auth.getSession();if(error||!session){location.replace('./login.html');return}
const {data:allowed,error:ae}=await client.rpc('is_admin_account');if(ae||allowed!==true){await client.auth.signOut();location.replace('./login.html');return}
const {data:aal,error:me}=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(me||aal.currentLevel!=='aal2'){location.replace('./login.html');return}
await loadDashboard();client.auth.onAuthStateChange((_event,s)=>{if(!s)location.replace('./login.html')});}
async function loadDashboard(){hideError();$('refresh').disabled=true;try{
const [{data:stats,error:se},{data:users,error:ue},{data:connections,error:ce},{data:leads,error:le}]=await Promise.all([client.rpc('admin_dashboard_stats'),client.rpc('admin_recent_users',{row_limit:12}),client.rpc('admin_recent_whatsapp_connections',{row_limit:12}),client.rpc('admin_recent_leads',{row_limit:25})]);
if(se)throw se;if(ue)throw ue;if(ce)throw ce;if(le)throw le;const x=stats?.[0]||{};
$('users').textContent=x.total_users??0;$('connected').textContent=x.whatsapp_connected_users??0;$('notConnected').textContent=x.users_without_whatsapp??0;$('active').textContent=x.active_whatsapp_connections??0;
$('userCount').textContent=`${users?.length||0} records`;$('connectionCount').textContent=`${connections?.length||0} records`;
$('usersBody').innerHTML=users?.length?users.map(u=>`<tr><td>${safe(u.display_name||u.email||'User')}</td><td>${date(u.created_at)}</td><td><span class="pill ${u.whatsapp_status==='connected'?'connected':'pending'}">${safe(u.whatsapp_status||'Not connected')}</span></td></tr>`).join(''):'<tr><td colspan="3" class="empty">No registered users yet.</td></tr>';
$('connectionsBody').innerHTML=connections?.length?connections.map(c=>`<tr><td>${safe(c.display_name||c.email||'User')}</td><td>${safe(c.masked_phone||'Not provided')}</td><td><span class="pill ${c.status==='connected'?'connected':'pending'}">${safe(c.status)}</span></td></tr>`).join(''):'<tr><td colspan="3" class="empty">No WhatsApp connections yet.</td></tr>';
$('leadCount').textContent=`${leads?.length||0} records`;$('leadsBody').innerHTML=leads?.length?leads.map(l=>`<tr><td>${safe(l.name)}</td><td>${safe(l.email)}</td><td>${safe(l.service)}</td><td>${safe(l.budget)}</td><td>${date(l.created_at)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No enquiries yet.</td></tr>';
}catch(e){showError('Could not load dashboard data. Check the Supabase SQL setup and permissions.')}finally{$('refresh').disabled=false}}
$('refresh').addEventListener('click',loadDashboard);$('logout').addEventListener('click',async()=>{await client?.auth.signOut();location.replace('./login.html')});
let idle;const IDLE_MS=15*60*1000;function resetIdle(){clearTimeout(idle);idle=setTimeout(async()=>{await client?.auth.signOut();location.replace('./login.html')},IDLE_MS)}
['click','keydown','mousemove','touchstart'].forEach(ev=>addEventListener(ev,resetIdle,{passive:true}));resetIdle();
boot();
