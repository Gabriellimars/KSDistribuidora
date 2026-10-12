const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const { DatabaseSync } = require("node:sqlite");
const { createHmac } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const toolDir = path.join(root, ".sites-runtime/auth-tools/node_modules");
const ts = require(path.join(toolDir, "typescript"));
const { z } = require(path.join(toolDir, "zod"));

function d1Database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");
  for (const migration of fs.readdirSync(path.join(root,"drizzle")).filter(f => f.endsWith(".sql")).sort())
    sqlite.exec(fs.readFileSync(path.join(root,"drizzle",migration),"utf8"));
  const db = { prepare(sql) {
    let args = [];
    const query = sqlite.prepare(sql);
    const self = {
      bind(...values) { args = values; return self; },
      async first() { return query.get(...args) || null; },
      async all() { return { results: query.all(...args), success: true }; },
      async raw() { query.setReturnArrays(true); return query.all(...args); },
      async run() { const r=query.run(...args); return { success: true, meta: { changes: Number(r.changes) } }; },
    };
    return self;
  }, async batch(queries) { return Promise.all(queries.map(q => q.all())); } };
  return { db, sqlite };
}
function moduleFrom(file, imports) {
  const source=fs.readFileSync(path.join(root,file),"utf8");
  const js=ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
  const module={exports:{}};
  vm.runInNewContext(js,{exports:module.exports,module,require: name => {
    if (Object.hasOwn(imports,name)) return imports[name];
    throw new Error("Unexpected import: "+name);
  },Response,Request,Headers,URL,Date,JSON,Object},{filename:file});
  return module.exports;
}
const addressSchema=moduleFrom("lib/customer-schema.ts",{zod:{z}}).customerAddressSchema;
const address={ name:"Cliente A",phone:"32999998888",city:"Coimbra",street:"Rua A",neighborhood:"Centro",number:"10",complement:"",reference:"" };
function customerRoute(db,user) {
  return moduleFrom("app/api/customer/route.ts",{
    "cloudflare:workers":{env:{DB:db}},
    "../../../lib/customer-auth":{authConfigured:()=>true},
    "../../../lib/customer-session":{
      getCustomer:async()=>user,
      privateHeaders:{"Cache-Control":"private, no-store",Vary:"Cookie"},
      sameOrigin:req=>req.headers.get("origin")===new URL(req.url).origin && req.headers.get("sec-fetch-site")!=="cross-site",
    },
    "../../../lib/customer-schema":{customerAddressSchema:addressSchema},
  });
}
function userRow(sqlite,id) {
  sqlite.prepare("INSERT INTO customer_user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,1,?,?)")
    .run(id,id,id+"@example.com",Date.now(),Date.now());
}
function request(method,body,origin="https://ks.example") {
  return new Request("https://ks.example/api/customer",{method,headers:{origin,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
test("profile persists per user and cannot be read or changed by another account",async()=>{
  const {db,sqlite}=d1Database();userRow(sqlite,"A");userRow(sqlite,"B");
  const a=customerRoute(db,{id:"A",name:"A",email:"A@example.com"});
  const b=customerRoute(db,{id:"B",name:"B",email:"B@example.com"});
  assert.equal((await a.PUT(request("PUT",address))).status,200);
  const profileA=await (await a.GET(request("GET"))).json();assert.equal(profileA.address.street,"Rua A");
  const profileB=await (await b.GET(request("GET"))).json();assert.equal(profileB.address,null);
  assert.equal((await b.PUT(request("PUT",{...address,userId:"A"}))).status,400);
  assert.equal((await b.DELETE(request("DELETE"))).status,200);
  assert.equal((await (await a.GET(request("GET"))).json()).address.street,"Rua A");
  await a.DELETE(request("DELETE"));assert.equal((await (await a.GET(request("GET"))).json()).address,null);
  sqlite.close();
});
test("profile rejects guests, cross-origin requests and malformed input",async()=>{
  const {db,sqlite}=d1Database();userRow(sqlite,"A");
  const a=customerRoute(db,{id:"A",name:"A",email:"A@example.com"});
  assert.equal((await a.PUT(request("PUT",address,"https://evil.example"))).status,403);
  assert.equal((await a.DELETE(request("DELETE",undefined,"https://evil.example"))).status,403);
  assert.equal((await a.PUT(request("PUT",{...address,phone:"1"}))).status,400);
  const guest=customerRoute(db,null);assert.equal((await guest.PUT(request("PUT",address))).status,401);
  assert.equal((await guest.DELETE(request("DELETE"))).status,401);
  const res=await a.GET(request("GET"));assert.match(res.headers.get("Cache-Control"),/no-store/);assert.equal(res.headers.get("Vary"),"Cookie");
  sqlite.close();
});
test("history contains only the signed-in customer's orders and excludes legacy guest orders",async()=>{
  const {db,sqlite}=d1Database();userRow(sqlite,"A");userRow(sqlite,"B");
  const insert=sqlite.prepare("INSERT INTO delivery_orders (id,user_id,created_at,status,customer_name,phone,items_json,extras_json,address_json,notes) VALUES (?,?,?,'aguardando_confirmacao','Cliente','32999998888','[]','[]','{}','')");
  insert.run("own","A",new Date().toISOString());insert.run("other","B",new Date().toISOString());insert.run("old",null,new Date().toISOString());
  const route=customerRoute(db,{id:"A",name:"A",email:"A@example.com"});
  assert.deepEqual((await (await route.GET(request("GET"))).json()).orders.map(x=>x.id),["own"]);
  sqlite.close();
});
test("real Better Auth on D1: signed cookie session, tamper rejection, logout and Google redirect state",async()=>{
  const output=path.join(root,".sites-runtime/auth-tools/compiled");
  fs.mkdirSync(output,{recursive:true});
  for(const [src,name] of [["db/auth-schema.ts","schema"],["lib/customer-auth.ts","auth"]]) {
    let js=ts.transpile(fs.readFileSync(path.join(root,src),"utf8"),{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022});
    js=js.replace('"../db/auth-schema"','"./schema.mjs"');
    fs.writeFileSync(path.join(output,name+".mjs"),js);
  }
  const {createCustomerAuth,authConfigured}=await import(pathToFileURL(path.join(output,"auth.mjs")).href);
  const {db,sqlite}=d1Database();
  const env={DB:db,BETTER_AUTH_URL:"https://ks.example",BETTER_AUTH_SECRET:"test-only-secret-with-at-least-32-characters",GOOGLE_CLIENT_ID:"test-client",GOOGLE_CLIENT_SECRET:"test-google-secret"};
  assert.equal(authConfigured({...env,GOOGLE_CLIENT_SECRET:undefined}),false);
  assert.equal(authConfigured({...env,BETTER_AUTH_URL:"https://ks.example/not-origin"}),false);
  const auth=createCustomerAuth(env);const ctx=await auth.$context;
  const user=await ctx.internalAdapter.createUser({name:"Cliente",email:"cliente@example.com",emailVerified:true});
  const session=await ctx.internalAdapter.createSession(user.id,false);
  const signature=createHmac("sha256",env.BETTER_AUTH_SECRET).update(session.token).digest("base64");
  const cookie="__Secure-ks-customer.session_token="+encodeURIComponent(session.token+"."+signature);
  const headers=new Headers({cookie,origin:"https://ks.example","Content-Type":"application/json","cf-connecting-ip":"192.0.2.1"});
  assert.equal((await auth.api.getSession({headers})).user.id,user.id);
  assert.equal(await auth.api.getSession({headers:new Headers({cookie:cookie+"x"})}),null);
  const login=await auth.handler(new Request("https://ks.example/api/auth/sign-in/social",{method:"POST",headers:{"Content-Type":"application/json",origin:"https://ks.example","cf-connecting-ip":"192.0.2.1"},body:JSON.stringify({provider:"google",callbackURL:"/conta.html",disableRedirect:true})}));
  assert.equal(login.status,200);
  const target=new URL((await login.json()).url);assert.equal(target.hostname,"accounts.google.com");assert.ok(target.searchParams.get("state"));assert.equal(target.searchParams.get("redirect_uri"),"https://ks.example/api/auth/callback/google");
  const bad=await auth.handler(new Request("https://ks.example/api/auth/callback/google?code=fake&state=invalid",{headers:{"cf-connecting-ip":"192.0.2.2"}}));
  assert.ok(bad.status>=300);assert.equal(sqlite.prepare("SELECT count(*) AS n FROM customer_user").get().n,1);
  const logout=await auth.handler(new Request("https://ks.example/api/auth/sign-out",{method:"POST",headers,body:"{}"}));
  assert.equal(logout.status,200);assert.equal(await auth.api.getSession({headers}),null);
  sqlite.close();
});

test("orders bind server identity, preserve guest checkout, and reject another user's duplicate ID",async()=>{
  const {db,sqlite}=d1Database();userRow(sqlite,"A");userRow(sqlite,"B");
  const catalog=moduleFrom("lib/delivery-catalog.ts",{});
  const orderSchema=moduleFrom("lib/order-schema.ts",{zod:{z},"./delivery-catalog":catalog}).orderSchema;
  const routeFor=customer=>moduleFrom("app/api/orders/route.ts",{
    "cloudflare:workers":{env:{DB:db}},
    "../../../lib/customer-session":{getCustomer:async()=>customer},
    "../../../lib/delivery-catalog":catalog,
    "../../../lib/order-schema":{orderSchema},
  });
  const payload={id:"00000000-0000-4000-8000-000000000001",adult:true,items:[],beverages:[{name:"Tanqueray",quantity:1}],extras:[],notes:"",address,userId:"B"};
  const req=body=>new Request("https://ks.example/api/orders",{method:"POST",headers:{origin:"https://ks.example","Content-Type":"application/json"},body:JSON.stringify(body)});
  const a=routeFor({id:"A"}),b=routeFor({id:"B"}),guest=routeFor(null);
  assert.equal((await a.POST(req(payload))).status,201);
  assert.equal(sqlite.prepare("SELECT user_id FROM delivery_orders WHERE id=?").get(payload.id).user_id,"A");
  assert.equal((await a.POST(req(payload))).status,200);
  assert.equal((await b.POST(req(payload))).status,409);
  assert.equal((await guest.POST(req(payload))).status,409);
  const guestPayload={...payload,id:"00000000-0000-4000-8000-000000000002"};
  assert.equal((await guest.POST(req(guestPayload))).status,201);
  assert.equal(sqlite.prepare("SELECT user_id FROM delivery_orders WHERE id=?").get(guestPayload.id).user_id,null);
  assert.equal((await guest.POST(req(guestPayload))).status,200);
  sqlite.close();
});
