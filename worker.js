const DEFAULT_DATA = {
  businessName: "Dushi Autos",
  tagline: "Car Repair & Diagnostics",
  phone: "",
  email: "",
  address: "",
  hours: "Mon–Fri: 8:30am–5:30pm\nSat: 9:00am–2:00pm\nSun: Closed",
  whatsapp: "",
  services: [
    { name: "Vehicle Diagnostics", description: "Professional fault finding and computer diagnostics." },
    { name: "Car Repairs", description: "Reliable repairs and maintenance for all makes and models." },
    { name: "Servicing", description: "Routine servicing to help keep your vehicle running smoothly." },
    { name: "MOT Repairs", description: "Repairs and preparation to help get your vehicle back on the road." }
  ]
};

const COOKIE = "dushi_admin";
const DATA_KEY = "site";

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extra }
  });
}

async function getData(env) {
  const raw = await env.DUSHI_DATA?.get(DATA_KEY);
  if (!raw) return DEFAULT_DATA;
  try { return { ...DEFAULT_DATA, ...JSON.parse(raw) }; }
  catch { return DEFAULT_DATA; }
}

async function saveData(env, data) {
  await env.DUSHI_DATA.put(DATA_KEY, JSON.stringify(data));
}

function base64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

function fromBase64url(s) {
  s = s.replace(/-/g,"+").replace(/_/g,"/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(text)
  ));
}

async function makeSession(secret) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const body = String(exp);
  const sig = base64url(await hmac(secret, body));
  return `${body}.${sig}`;
}

async function validSession(request, secret) {
  if (!secret) return false;
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!match) return false;
  const token = decodeURIComponent(match[1]);
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const expected = base64url(await hmac(secret, exp));
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i=0; i<sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function adminPage() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dushi Autos Admin</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0b0d10;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.wrap{max-width:720px;margin:auto;padding:22px}.brand{font-size:26px;font-weight:800}.muted{color:#aab0b8}
.card{background:#15181d;border:1px solid #2a2f37;border-radius:18px;padding:20px;margin-top:16px}
h1{margin:0 0 6px}h2{margin-top:0}label{display:block;margin:14px 0 7px;font-weight:650}
input,textarea{width:100%;padding:13px;border-radius:10px;border:1px solid #3a404a;background:#0e1115;color:#fff;font-size:16px}
textarea{min-height:90px;resize:vertical}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
button{border:0;border-radius:10px;padding:13px 18px;background:#d71920;color:#fff;font-size:16px;font-weight:700;margin-top:16px}
button.secondary{background:#2b3038}.service{border:1px solid #303640;border-radius:12px;padding:14px;margin-top:12px}
.top{display:flex;justify-content:space-between;align-items:center;gap:10px}.success{color:#70e39a;margin-top:12px}.error{color:#ff7b7b;margin-top:12px}
@media(max-width:600px){.row{grid-template-columns:1fr}}
</style></head>
<body><div class="wrap">
<div class="brand">DUSHI AUTOS</div><div class="muted">Website editor</div>
<div id="app"></div>
<script>
const app=document.getElementById("app");
async function api(url,opt){const r=await fetch(url,opt);return r.json();}
function login(){
 app.innerHTML=\`<div class="card"><h1>Admin login</h1><div class="muted">Enter your private admin password.</div>
 <label>Password</label><input id="pw" type="password" autocomplete="current-password">
 <button onclick="doLogin()">Log in</button><div id="msg"></div></div>\`;
}
async function doLogin(){
 const msg=document.getElementById("msg");
 const r=await api("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({password:document.getElementById("pw").value})});
 if(r.ok) load(); else msg.className="error",msg.textContent=r.error||"Login failed";
}
function field(label,id,val,area=false){
 return \`<label>\${label}</label>\${area?\`<textarea id="\${id}">\${esc(val)}</textarea>\`:\`<input id="\${id}" value="\${esc(val)}">\`}\`;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
async function load(){
 const d=await api("/api/data");
 if(d.error){login();return}
 let services=d.services||[];
 app.innerHTML=\`<div class="card">
 <div class="top"><div><h1>Business details</h1><div class="muted">Changes appear on your website after saving.</div></div><button class="secondary" onclick="logout()">Log out</button></div>
 \${field("Business name","businessName",d.businessName)}
 \${field("Tagline","tagline",d.tagline)}
 <div class="row">\${field("Phone","phone",d.phone)}\${field("Email","email",d.email)}</div>
 \${field("Address","address",d.address)}
 \${field("Opening hours","hours",d.hours,true)}
 \${field("WhatsApp number (optional)","whatsapp",d.whatsapp)}
 </div>
 <div class="card"><div class="top"><div><h2>Services</h2><div class="muted">Add, edit or remove services.</div></div><button onclick="addService()">Add service</button></div>
 <div id="services"></div><button onclick="save()">Save website</button><div id="msg"></div></div>\`;
 renderServices(services);
}
function renderServices(services){
 document.getElementById("services").innerHTML=services.map((s,i)=>
 \`<div class="service">\${field("Service name","sn"+i,s.name)}\${field("Description","sd"+i,s.description,true)}
 <button class="secondary" onclick="removeService(\${i})">Remove service</button></div>\`).join("");
 window._services=services;
}
function addService(){window._services.push({name:"New service",description:""});renderServices(window._services);}
function removeService(i){window._services.splice(i,1);renderServices(window._services);}
async function save(){
 const services=window._services.map((s,i)=>({name:document.getElementById("sn"+i).value,description:document.getElementById("sd"+i).value}));
 const d={businessName:document.getElementById("businessName").value,tagline:document.getElementById("tagline").value,phone:document.getElementById("phone").value,email:document.getElementById("email").value,address:document.getElementById("address").value,hours:document.getElementById("hours").value,whatsapp:document.getElementById("whatsapp").value,services};
 const r=await api("/api/data",{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify(d)});
 const m=document.getElementById("msg");m.className=r.ok?"success":"error";m.textContent=r.ok?"Saved successfully.":"Could not save.";
}
async function logout(){await fetch("/api/logout",{method:"POST"});login();}
load();
</script></div></body></html>`;
}

function sitePage(data) {
  const phone = data.phone || "";
  const phoneHref = phone ? `tel:${phone.replace(/[^+\\d]/g,"")}` : "#contact";
  const wa = data.whatsapp ? data.whatsapp.replace(/\\D/g,"") : "";
  const waHref = wa ? `https://wa.me/${wa}` : "#contact";
  const services = (data.services || []).map(s => `
    <article class="service">
      <div class="icon">✓</div>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
    </article>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(data.businessName)} | ${esc(data.tagline)}</title>
<meta name="description" content="${esc(data.businessName)} - ${esc(data.tagline)}">
<style>
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#090b0e;color:#f7f7f7;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
a{text-decoration:none;color:inherit}.nav{position:sticky;top:0;z-index:5;background:rgba(9,11,14,.92);backdrop-filter:blur(10px);border-bottom:1px solid #22262c}
.navin{max-width:1100px;margin:auto;padding:16px 20px;display:flex;align-items:center;justify-content:space-between}.logo{font-size:22px;font-weight:900;letter-spacing:.5px}.logo span{color:#e31b23}
nav{display:flex;gap:22px;font-size:14px;color:#c7cbd0}nav a:hover{color:#fff}
.hero{background:radial-gradient(circle at 80% 20%,#3a1014 0,#130b0d 30%,#090b0e 65%);padding:90px 20px 80px;border-bottom:1px solid #222}
.heroIn{max-width:1100px;margin:auto}.badge{display:inline-block;border:1px solid #5b2529;color:#ff8a8f;border-radius:99px;padding:7px 12px;font-size:13px;font-weight:700}
h1{font-size:clamp(42px,8vw,76px);line-height:.98;margin:18px 0 16px;max-width:850px}.hero p{font-size:20px;color:#b9bec6;max-width:680px;line-height:1.6}.buttons{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.btn{display:inline-block;padding:14px 20px;border-radius:10px;background:#e31b23;font-weight:800}.btn.alt{background:#1c2128;border:1px solid #343a43}
section{max-width:1100px;margin:auto;padding:70px 20px}h2{font-size:36px;margin:0 0 10px}.lead{color:#aeb4bd;max-width:700px;line-height:1.7}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:30px}.service{background:#11151a;border:1px solid #282e36;border-radius:16px;padding:24px}.icon{width:36px;height:36px;border-radius:10px;background:#3a1114;color:#ff6c72;display:grid;place-items:center;font-weight:900}.service h3{margin:18px 0 8px;font-size:21px}.service p{color:#aeb4bd;line-height:1.6;margin:0}
.contact{background:#11151a;border-top:1px solid #242a31;border-bottom:1px solid #242a31}.contactgrid{display:grid;grid-template-columns:1fr 1fr;gap:30px}.box{background:#0b0e12;border:1px solid #292f37;border-radius:16px;padding:24px}.line{padding:13px 0;border-bottom:1px solid #242a31;color:#c7cbd0}.line:last-child{border:0}.hours{white-space:pre-line;line-height:1.8;color:#c7cbd0}
footer{padding:30px 20px;text-align:center;color:#7f8791;font-size:13px}
@media(max-width:700px){nav{display:none}.grid,.contactgrid{grid-template-columns:1fr}.hero{padding-top:65px}}
</style></head><body>
<header class="nav"><div class="navin"><a class="logo" href="/"><img src="/3E29DAAE-5FED-4936-B151-AA9F2041E9F0.png" alt="Dushi Autos">
<main>
<section class="hero"><div class="heroIn"><div class="badge">Professional vehicle care</div>
<h1>${esc(data.businessName)}</h1><p>${esc(data.tagline)}</p>
<div class="buttons">${phone?`<a class="btn" href="${phoneHref}">Call ${esc(phone)}</a>`:""}${wa?`<a class="btn alt" href="${waHref}" target="_blank" rel="noopener">WhatsApp us</a>`:`<a class="btn alt" href="#contact">Get in touch</a>`}</div></div></section>
<section id="services"><h2>Our services</h2><p class="lead">Reliable automotive repairs, servicing and diagnostics for your vehicle.</p><div class="grid">${services}</div></section>
<section id="about"><h2>About ${esc(data.businessName)}</h2><p class="lead">We provide practical, professional vehicle repair and diagnostic services with a focus on keeping your car safe, reliable and road-ready.</p></section>
<div class="contact"><section id="contact"><div class="contactgrid"><div><h2>Get in touch</h2><p class="lead">Contact us to discuss your vehicle or arrange a visit.</p><div class="buttons">${phone?`<a class="btn" href="${phoneHref}">Call us</a>`:""}${data.email?`<a class="btn alt" href="mailto:${esc(data.email)}">Email us</a>`:""}</div></div><div class="box">
${data.address?`<div class="line"><strong>Address</strong><br>${esc(data.address)}</div>`:""}${data.phone?`<div class="line"><strong>Phone</strong><br>${esc(data.phone)}</div>`:""}${data.email?`<div class="line"><strong>Email</strong><br>${esc(data.email)}</div>`:""}<div class="line"><strong>Opening hours</strong><div class="hours">${esc(data.hours)}</div></div></div></div></section></div>
</main><footer>© ${new Date().getFullYear()} ${esc(data.businessName)}. All rights reserved.</footer>
</body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (url.pathname === "/api/login" && method === "POST") {
      if (!env.ADMIN_PASSWORD) return json({error:"Admin password has not been configured yet."},500);
      let body = {};
      try { body = await request.json(); } catch {}
      if (!body.password || body.password !== env.ADMIN_PASSWORD)
        return json({error:"Incorrect password."},401);
      const token = await makeSession(env.ADMIN_PASSWORD);
      return json({ok:true},200 ,{
        "Set-Cookie": `${COOKIE}=${encodeURIComponent(token)}; Max-Age=86400; Path=/; HttpOnly; Secure; SameSite=Strict`
      });
    }

    if (url.pathname === "/api/logout" && method === "POST") {
      return new Response(JSON.stringify({ok:true}), {
        headers: {"content-type":"application/json","Set-Cookie":`${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`}
      });
    }

    if (url.pathname === "/api/data") {
      if (!(await validSession(request, env.ADMIN_PASSWORD)))
        return json({error:"Not authorised."},401);
      if (method === "GET") return json(await getData(env));
      if (method === "PUT") {
        let data;
        try { data = await request.json(); } catch { return json({error:"Invalid data."},400); }
        const clean = {
          businessName: String(data.businessName || "").slice(0,100),
          tagline: String(data.tagline || "").slice(0,160),
          phone: String(data.phone || "").slice(0,60),
          email: String(data.email || "").slice(0,120),
          address: String(data.address || "").slice(0,250),
          hours: String(data.hours || "").slice(0,500),
          whatsapp: String(data.whatsapp || "").slice(0,40),
          services: Array.isArray(data.services) ? data.services.slice(0,30).map(s => ({
            name:String(s?.name || "").slice(0,100),
            description:String(s?.description || "").slice(0,500)
          })) : []
        };
        await saveData(env, clean);
        return json({ok:true});
      }
    }

    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      return new Response(adminPage(), {headers:{"content-type":"text/html;charset=utf-8"}});
    }

    if (url.pathname === "/api/site") return json(await getData(env));

    return new Response(sitePage(await getData(env)), {
      headers: {"content-type":"text/html;charset=utf-8","cache-control":"no-store"}
    });
  }
};
