import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {Pool} from 'pg';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {financialWeek,validateAllocations,validateInstallments,outstandingCents} from './domain/finance.mjs';
const root=dirname(fileURLToPath(import.meta.url));
const pool=process.env.DATABASE_URL?new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DB_SSL==='require'?{rejectUnauthorized:true}:undefined}):null;
const token=process.env.API_TOKEN;
const port=Number(process.env.PORT||3000);
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))}
function authorized(req){if(!token||token.length<32)return false;const supplied=(req.headers.authorization||'').replace(/^Bearer /,'');const a=Buffer.from(supplied),b=Buffer.from(token);return a.length===b.length&&timingSafeEqual(a,b)}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>100000)throw Object.assign(new Error('Corpo excede limite'),{status:413})}return JSON.parse(text||'{}')}
async function transaction(fn){const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}
async function list(client,table,limit=200){const allowed=new Set(['account_categories','cost_centers','projects','vendors','financial_accounts','obligations','installments','payments']);if(!allowed.has(table))throw new Error('Recurso inválido');const result=await client.query('SELECT * FROM '+table+' ORDER BY 1 DESC LIMIT $1',[limit]);return result.rows}
function positiveUuid(value){return typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value)}
function assertUuid(value,label){if(!positiveUuid(value))throw new Error(label+' inválido')}
function assertText(value,label,max=250){if(typeof value!=='string'||!value.trim()||value.length>max)throw new Error(label+' inválido');return value.trim()}
function assertDate(value,label){financialWeek(value);return value}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');if(req.method==='GET'&&url.pathname==='/api/health'){if(!pool)return json(res,503,{status:'configuration',database:'not_configured'});try{await pool.query('SELECT 1');return json(res,200,{status:'ok',database:'connected'})}catch{return json(res,503,{status:'database_unavailable'})}}
 if(req.method==='GET'&&url.pathname==='/'){const html=await readFile(join(root,'../public/index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"});return res.end(html)}
 if(!url.pathname.startsWith('/api/'))return json(res,404,{error:'Não encontrado'});
 if(!authorized(req))return json(res,401,{error:'Não autorizado ou configuração de autenticação ausente'});
 if(!pool)return json(res,503,{error:'Banco não configurado'});
 if(req.method==='GET'&&url.pathname==='/api/summary'){const result=await pool.query(`SELECT count(*)::int AS count,coalesce(sum(total_cents),0)::bigint AS total_cents FROM obligations WHERE status<>'void'`);return json(res,200,result.rows[0])}
 const match=url.pathname.match(/^\/api\/(account_categories|cost_centers|projects|vendors|financial_accounts|obligations|installments|payments)$/);
 if(req.method==='GET'&&match){const rows=await list(pool,match[1]);return json(res,200,{items:rows})}
 if(req.method==='POST'&&url.pathname==='/api/vendors'){const input=await body(req);const name=assertText(input.name,'Fornecedor');const result=await pool.query('INSERT INTO vendors(name,tax_id) VALUES($1,$2) RETURNING *',[name,input.taxId||null]);return json(res,201,result.rows[0])}
 if(req.method==='POST'&&url.pathname==='/api/cost_centers'){const input=await body(req);const name=assertText(input.name,'Centro de custo');const result=await pool.query('INSERT INTO cost_centers(name,code) VALUES($1,$2) RETURNING *',[name,input.code||null]);return json(res,201,result.rows[0])}
 if(req.method==='POST'&&url.pathname==='/api/projects'){const input=await body(req);const name=assertText(input.name,'Projeto');const result=await pool.query('INSERT INTO projects(name,code) VALUES($1,$2) RETURNING *',[name,input.code||null]);return json(res,201,result.rows[0])}
 if(req.method==='POST'&&url.pathname==='/api/account_categories'){const input=await body(req);const name=assertText(input.name,'Conta');if(input.parentId)assertUuid(input.parentId,'Conta superior');const result=await pool.query('INSERT INTO account_categories(name,code,parent_id,kind) VALUES($1,$2,$3,$4) RETURNING *',[name,input.code||null,input.parentId||null,input.kind||'expense']);return json(res,201,result.rows[0])}
 if(req.method==='POST'&&url.pathname==='/api/obligations'){const input=await body(req);assertText(input.description,'Descrição',500);assertDate(input.competenceDate,'Competência');if(input.vendorId)assertUuid(input.vendorId,'Fornecedor');if(!Number.isSafeInteger(input.totalCents)||input.totalCents<=0)throw new Error('Total inválido');validateAllocations(input.totalCents,input.allocations);validateInstallments(input.totalCents,input.installments);for(const a of input.allocations){assertUuid(a.categoryId,'Categoria');if(a.costCenterId)assertUuid(a.costCenterId,'Centro de custo');if(a.projectId)assertUuid(a.projectId,'Projeto')}
 const result=await transaction(async c=>{const ob=await c.query('INSERT INTO obligations(vendor_id,description,total_cents,competence_date,status) VALUES($1,$2,$3,$4,$5) RETURNING *',[input.vendorId||null,input.description,input.totalCents,input.competenceDate,'draft']);const id=ob.rows[0].id;for(const a of input.allocations)await c.query('INSERT INTO expense_allocations(obligation_id,category_id,cost_center_id,project_id,amount_cents) VALUES($1,$2,$3,$4,$5)',[id,a.categoryId,a.costCenterId||null,a.projectId||null,a.amountCents]);for(const p of input.installments)await c.query('INSERT INTO installments(obligation_id,installment_number,due_date,amount_cents) VALUES($1,$2,$3,$4)',[id,p.number,p.dueDate,p.amountCents]);await c.query('INSERT INTO audit_events(entity_type,entity_id,action,actor_ref) VALUES($1,$2,$3,$4)',['obligation',id,'create','api-token']);return ob.rows[0]});return json(res,201,result)}
 if(req.method==='GET'&&url.pathname==='/api/expenses'){const result=await pool.query(`SELECT o.id,o.description,o.total_cents,o.competence_date,o.status,v.name AS vendor_name,coalesce(json_agg(json_build_object('categoryId',a.category_id,'costCenterId',a.cost_center_id,'projectId',a.project_id,'amountCents',a.amount_cents)) FILTER(WHERE a.id IS NOT NULL),'[]') AS allocations FROM obligations o LEFT JOIN vendors v ON v.id=o.vendor_id LEFT JOIN expense_allocations a ON a.obligation_id=o.id GROUP BY o.id,v.name ORDER BY o.competence_date DESC,o.created_at DESC LIMIT 200`);return json(res,200,{items:result.rows})}
 return json(res,404,{error:'Rota não encontrada'});
 }catch(e){const code=e.status||(/inválid|obrigat|corresponder|excede|duplicado|precisa|deve|não configurado/i.test(e.message)?400:500);if(code===500)console.error('Internal request error',e.code||e.name);json(res,code,{error:code===500?'Erro interno':e.message})}});
server.listen(port,'0.0.0.0',()=>console.log('Central Financeira API listening on '+port));
