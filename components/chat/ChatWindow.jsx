"use client";
import {useState,useRef,useEffect,useCallback} from "react";
import Link from "next/link";
import {MessageBubble} from "@/components/chat/MessageBubble.jsx";
import {InputBar} from "@/components/chat/InputBar.jsx";
import {SuggestedPrompts} from "@/components/chat/SuggestedPrompts.jsx";

const STORE="agentkit-conversations-v1",ACTIVE="agentkit-active-conversation";
const uid=()=>globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
const fresh=()=>({id:uid(),title:"New chat",createdAt:Date.now(),updatedAt:Date.now(),messages:[]});
const normalizeMessage=(m,i)=>{if(!m||typeof m!=="object")return null;const content=typeof m.content==="string"?m.content:(typeof m.text==="string"?m.text:"");return {...m,id:m.id||`legacy-${Date.now()}-${i}`,role:m.role==="assistant"?"assistant":"user",content,parts:Array.isArray(m.parts)?m.parts:(content?[{type:"text",text:content}]:[])} };
const normalizeConvo=(c,i)=>{if(!c||typeof c!=="object")return null;const messages=Array.isArray(c.messages)?c.messages.map(normalizeMessage).filter(Boolean):[];return {id:c.id||`chat-${Date.now()}-${i}`,title:typeof c.title==="string"?c.title:"New chat",createdAt:Number(c.createdAt)||Date.now(),updatedAt:Number(c.updatedAt)||Date.now(),messages}};
function load(){try{const raw=JSON.parse(localStorage.getItem(STORE)||"[]");return Array.isArray(raw)?raw.map(normalizeConvo).filter(Boolean):[]}catch{try{localStorage.removeItem(STORE)}catch{}return[]}}
function save(v){try{localStorage.setItem(STORE,JSON.stringify(v))}catch{}}
function Glyph({state="idle",small=false}){return <span className={`living-glyph glyph-${state} ${small?"living-glyph-small":""}`}><i/><b/></span>}

export function ChatWindow({agentName,welcomeMessage,suggestedPrompts,showToolCalls,showBranding,userId="anonymous"}){
 const[messages,setMessages]=useState([]),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(null),[convos,setConvos]=useState([]),[active,setActive]=useState(null),[drawer,setDrawer]=useState(false),[state,setState]=useState("idle"),[tool,setTool]=useState(null),[search,setSearch]=useState("");
 const bottom=useRef(null),abort=useRef(null),activeRef=useRef(null);
 useEffect(()=>{try{let list=load(),aid=localStorage.getItem(ACTIVE),c=list.find(x=>x.id===aid);if(!c){c=fresh();list=[c,...list];save(list)}setConvos(list);setActive(c.id);activeRef.current=c.id;setMessages(c.messages||[]);localStorage.setItem(ACTIVE,c.id)}catch{const c=fresh();setConvos([c]);setActive(c.id);activeRef.current=c.id;setMessages([])}},[]);
 useEffect(()=>{activeRef.current=active},[active]); useEffect(()=>bottom.current?.scrollIntoView({behavior:"smooth"}),[messages,busy]);
 const persist=useCallback(next=>{setMessages(next);const aid=activeRef.current;if(!aid)return;setConvos(prev=>{const list=prev.map(c=>c.id===aid?{...c,messages:next,updatedAt:Date.now(),title:c.title==="New chat"&&next.find(m=>m.role==="user")?.content?next.find(m=>m.role==="user").content.slice(0,48):c.title}:c).sort((a,b)=>b.updatedAt-a.updatedAt);save(list);return list})},[]);
 const newChat=()=>{const c=fresh(),list=[c,...convos];save(list);setConvos(list);setActive(c.id);activeRef.current=c.id;setMessages([]);try{localStorage.setItem(ACTIVE,c.id)}catch{}setDrawer(false);setTool(null)};
 const choose=c=>{setActive(c.id);activeRef.current=c.id;setMessages(c.messages||[]);try{localStorage.setItem(ACTIVE,c.id)}catch{}setDrawer(false);setTool(null)};
 const del=(e,id)=>{e.stopPropagation();let list=convos.filter(c=>c.id!==id);if(!list.length)list=[fresh()];save(list);setConvos(list);if(id===activeRef.current)choose(list[0])};
 const clear=()=>{persist([]);setTool(null)};
 const stop=()=>{abort.current?.abort();setBusy(false);setState("idle")};
 const send=useCallback(async text=>{if(!text?.trim()||busy)return;setError(null);const user={id:"u-"+Date.now(),role:"user",content:text,parts:[{type:"text",text}]},before=[...messages,user];persist(before);setBusy(true);setState("thinking");setTool({name:"Thinking",done:false});const ctrl=new AbortController();abort.current=ctrl;
 try{let settings={};try{settings=JSON.parse(localStorage.getItem("agentkit-settings")||"{}")}catch{}const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:before,userId,sessionId:activeRef.current,settings}),signal:ctrl.signal});if(!res.ok){const e=await res.json().catch(()=>({}));throw new Error(e.message??e.error??`HTTP ${res.status}`)}
 const aid="a-"+Date.now(),assistant={id:aid,role:"assistant",content:"",parts:[{type:"text",text:""}]};let current=[...before,assistant];persist(current);const reader=res.body.getReader(),decoder=new TextDecoder();let acc="",parts=[],buf="";const update=()=>{current=current.map(m=>m.id===aid?{...m,content:acc,parts:[{type:"text",text:acc},...parts]}:m);persist(current)};
 while(true){const{done,value}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});const lines=buf.split("\n");buf=lines.pop()??"";for(const line of lines){if(!line.startsWith("data: "))continue;try{const o=JSON.parse(line.slice(6));if(o.type==="text-delta"&&o.delta){setState("writing");acc+=o.delta;update()}else if(o.type==="tool-call"){setState(o.toolName?.includes("search")?"searching":"tool");setTool({name:o.toolName||"Tool",done:false});parts=[...parts,{type:"tool-invocation",state:"call",toolName:o.toolName,args:o.args??{},toolInvocation:{toolName:o.toolName,args:o.args??{},state:"call"}}];update()}else if(o.type==="tool-result"){setState("reading");setTool({name:o.toolName||"Tool",done:true});parts=parts.map(p=>p.type==="tool-invocation"&&p.toolName===o.toolName&&p.state==="call"?{...p,state:"result",toolInvocation:{...p.toolInvocation,state:"result",result:o.result}}:p);update()}else if(o.type==="error")setError(o.message??"Stream error")}catch{}}}setState("success");setTimeout(()=>setState("idle"),700)}catch(e){if(e.name!=="AbortError"){setError(e.message||"Something went wrong");setState("error")}}finally{setBusy(false)}},[messages,busy,userId,persist]);
 const submit=e=>{e?.preventDefault();const t=input.trim();if(!t)return;setInput("");send(t)};
 const filtered=convos.filter(c=>String(c?.title||"New chat").toLowerCase().includes(search.toLowerCase()));
 return <div className="living-shell">
  <aside className={`living-side ${drawer?"living-side-open":""}`}>
   <div className="living-brand"><div className="living-brand-left"><Glyph state={state}/><div><strong>AgentKit</strong><small><i/> Ready</small></div></div><button className="living-close" onClick={()=>setDrawer(false)}>×</button></div>
   <button className="living-new" onClick={newChat}><span>＋</span> New Chat <kbd>⌘K</kbd></button>
   <div className="living-search">⌕ <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search conversations..."/></div>
   <div className="living-history">{filtered.map(c=><button key={c.id} onClick={()=>choose(c)} className={c.id===active?"active":""}><span className="dot"/><span>{c.title}</span><em onClick={e=>del(e,c.id)}>×</em></button>)}</div>
   <div className="living-bottom"><Link href="/settings">⌘ Tools & Extensions</Link><Link href="/settings">⚙ Settings</Link></div>
  </aside>
  <main className="living-main">
   <header className="living-head"><div className="living-head-left"><button className="living-menu" onClick={()=>setDrawer(true)}>☰</button><Glyph state={state}/><b>Agent</b><span className="living-online"><i/> {busy?state:"Online"}</span></div><div className="living-head-actions"><Link href="/settings" className="living-model">Model ▾</Link><button onClick={clear}>⌫ Clear</button></div></header>
   <section className="living-chat"><div className="living-chat-inner">
    {!messages.length&&<div className="living-welcome"><Glyph state={state}/><h1>{agentName}</h1><p>{welcomeMessage}</p>{suggestedPrompts?.length>0&&<SuggestedPrompts prompts={suggestedPrompts} onSelect={setInput}/>}</div>}
    {messages.map((m,i)=><div key={m.id||i} className={m.role==="assistant"?"living-assistant":"living-user"}>{m.role==="assistant"&&<div className="living-identity"><Glyph state={busy?state:"idle"} small/><span>Agent</span></div>}<MessageBubble message={m} agentName={agentName} agentColor="#b4c5ff" agentInitials="AG" showToolCalls={showToolCalls}/></div>)}
    {busy&&tool&&<div className="living-tool"><span>{tool.done?"✓":"◌"}</span><b>{tool.done?`${tool.name} complete`:`${tool.name}…`}</b></div>}
    {error&&<div className="living-error">{error}</div>}<div ref={bottom}/>
   </div></section>
   <footer className="living-composer"><div className="living-composer-inner"><div className="living-input-wrap"><button className="living-plus">＋</button><InputBar input={input} onChange={e=>{setInput(e.target.value);if(!busy)setState(e.target.value?"attentive":"idle")}} onSubmit={submit} isLoading={busy} onStop={stop} agentColor="#b4c5ff"/></div><div className="living-utils"><span>◎ Web Search</span><small>{showBranding?"AgentKit can make mistakes. Verify important information.":""}</small></div></div></footer>
  </main>
 </div>
}
