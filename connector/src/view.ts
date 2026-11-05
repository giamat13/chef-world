// MCP Apps view: one self-contained HTML page rendered by claude.ai in a sandboxed iframe.
// It speaks the MCP Apps postMessage protocol directly (no bundler, no external scripts).
// Renders kind "page" (title, chips, key/value rows, sections of items, note). Items with `call` open another
// tool's result inside the card; a back button returns. Everything is written with textContent, never innerHTML.
// Keep backticks and dollar-brace out of the view code: it lives inside a String.raw template literal.
export const VIEW_URI = "ui://chef-world-connector/card.html";
export const VIEW_MIME = "text/html;profile=mcp-app";
// No external resources: nothing to allow.
export const VIEW_CSP = { resourceDomains: [] as string[] };

export const VIEW_HTML = /* html */ String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#fff;--fg:#1f1d1a;--mut:#6f6a62;--line:#e8e3da;--accent:#b5442b;--chip:#f5efe6}
:root[data-theme=dark]{--bg:#1b1917;--fg:#f1ece4;--mut:#a9a197;--line:#3a3530;--accent:#e8836a;--chip:#2b2722}
body{margin:0;font:14px/1.45 system-ui,sans-serif;background:var(--bg);color:var(--fg)}
.card{padding:14px 16px}
.top{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.back{border:1px solid var(--line);background:none;color:var(--accent);border-radius:6px;padding:2px 8px;cursor:pointer;font:inherit;font-size:12px}
h1{margin:0;font-size:18px;color:var(--accent);overflow-wrap:anywhere}
.sub{color:var(--mut);margin:2px 0 8px;overflow-wrap:anywhere}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}
.chip{background:var(--chip);border-radius:999px;padding:2px 9px;font-size:12px}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:0 0 8px}dt{color:var(--mut)}dd{margin:0;overflow-wrap:anywhere}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);margin:14px 0 4px}
.item{display:flex;gap:8px;padding:7px 0;border-top:1px solid var(--line)}
.item.go{cursor:pointer}.item.go:hover .t{text-decoration:underline}
.ic{width:1.6em;flex:none;text-align:center}
.body{flex:1;min-width:0}.t{font-weight:600;overflow-wrap:anywhere}.s{color:var(--mut);font-size:13px;overflow-wrap:anywhere}
.badge{flex:none;align-self:flex-start;font-size:12px;color:var(--mut);border:1px solid var(--line);border-radius:6px;padding:0 6px}
.empty{color:var(--mut);font-style:italic;padding:6px 0}
a{color:var(--accent)}
.note{color:var(--mut);font-size:12px;margin-top:12px;white-space:pre-wrap;overflow-wrap:anywhere}
</style></head><body><div id="root"></div><script>
(function(){
var root=document.getElementById("root"),nextId=2,pending={},stack=[],current=null;
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=String(x);return e}
function add(p,c){if(c)p.appendChild(c);return p}
function send(m){parent.postMessage(Object.assign({jsonrpc:"2.0"},m),"*")}
function request(method,params){return new Promise(function(res,rej){var id=nextId++;pending[id]={res:res,rej:rej};send({id:id,method:method,params:params})})}
function size(){send({method:"ui/notifications/size-changed",params:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}})}
function theme(ctx){if(ctx&&ctx.theme)document.documentElement.setAttribute("data-theme",ctx.theme)}
function textOf(r){return(r&&r.content||[]).map(function(c){return c.text||""}).join("\n")}
function safeUrl(u){try{var x=new URL(String(u));return(x.protocol==="https:"||x.protocol==="http:")?x.href:null}catch(e){return null}}
function renderPage(d){
 var c=el("div","card");
 if(stack.length){var top=el("div","top");var b=el("button","back","← Back");b.type="button";b.addEventListener("click",back);add(top,b);add(c,top)}
 add(c,el("h1",null,d.title||""));
 if(d.sub)add(c,el("div","sub",d.sub));
 if(d.chips&&d.chips.length){var ch=el("div","chips");d.chips.forEach(function(t){add(ch,el("span","chip",t))});add(c,ch)}
 var rows=(d.rows||[]).filter(function(r){return r&&r[1]!=null&&String(r[1])!==""});
 if(rows.length){var dl=el("dl");rows.forEach(function(r){add(dl,el("dt",null,r[0]));add(dl,el("dd",null,r[1]))});add(c,dl)}
 (d.sections||[]).forEach(function(s){
  add(c,el("h2",null,s.heading));
  var items=s.items||[];
  if(!items.length){add(c,el("div","empty",s.empty||"Nothing here."));return}
  items.forEach(function(it){
   var row=el("div","item");
   if(it.call){row.classList.add("go");row.addEventListener("click",function(){go(it.call)})}
   if(it.icon)add(row,el("div","ic",it.icon));
   var body=el("div","body");var t=el("div","t");
   var u=safeUrl(it.url);
   if(u){var a=el("a",null,it.title||"");a.href=u;a.target="_blank";a.rel="noopener noreferrer";add(t,a)}else t.textContent=it.title||"";
   add(body,t);if(it.sub)add(body,el("div","s",it.sub));add(row,body);
   if(it.badge)add(row,el("div","badge",it.badge));
   add(c,row)});
 });
 if(d.note)add(c,el("div","note",d.note));
 return c}
function show(d){current=d;root.textContent="";add(root,renderPage(d));size()}
function showText(t){current=null;root.textContent="";add(root,add(el("div","card"),el("div",null,t||"No visual data.")));size()}
function go(call){request("tools/call",call).then(function(r){
  var d=r&&r.structuredContent;
  if(d&&d.kind==="page"&&!r.isError){if(current)stack.push(current);show(d)}
  else showText(textOf(r)||"No result.")
 },function(e){showText("Could not load: "+(e&&e.message||"error"))})}
function back(){if(!stack.length)return;show(stack.pop())}
window.addEventListener("message",function(e){var m=e.data;if(!m||m.jsonrpc!=="2.0")return;
 if(m.id!=null&&pending[m.id]&&(m.result!==undefined||m.error)){var p=pending[m.id];delete pending[m.id];if(m.error)p.rej(m.error);else p.res(m.result);return}
 if(m.method==="ui/notifications/tool-result"){var r=m.params||{};stack=[];
  if(r.structuredContent&&r.structuredContent.kind==="page")show(r.structuredContent);else showText(textOf(r)||"No visual data for this result.")}
 else if(m.method==="ui/notifications/host-context-changed"){theme(m.params)}
 else if(m.method==="ui/resource-teardown"&&m.id!=null){send({id:m.id,result:{}})}
});
if(window.ResizeObserver)new ResizeObserver(size).observe(document.body);
request("ui/initialize",{appInfo:{name:"chef-world-card",version:"1.0.0"},appCapabilities:{},protocolVersion:"2026-01-26"}).then(function(r){if(r)theme(r.hostContext);send({method:"ui/notifications/initialized",params:{}});size()},function(){});
})();
</script></body></html>`;
