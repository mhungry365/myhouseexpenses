import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://jadopmcgrcoaltyzevhi.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZG9wbWNncmNvYWx0eXpldmhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NDk0NzYsImV4cCI6MjA5MzEyNTQ3Nn0.uA4h2vb6V79Ip-CCzlLX7TxfSLSgxabONXr8VWTgTc8";
const SUPER_ADMIN_EMAIL = "mhungry365@gmail.com";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PERSON_COLORS = ["#0f172a","#f97316","#3b82f6","#22c55e","#a855f7","#ef4444","#14b8a6","#eab308","#ec4899","#06b6d4"];
const fmt = (n) => `€${Number(n).toFixed(2)}`;
const fmtShort = (n) => { const v=Number(n); return v>=1000?`€${(v/1000).toFixed(1)}k`:`€${v.toFixed(2)}`; };
const monthLabel = (y,m) => new Date(y,m-1).toLocaleString("default",{month:"long",year:"numeric"});
const initials = (name) => name?.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2)||"?";
const catAbbr = (name) => name?name.slice(0,3).toUpperCase():"???";
const generateCode = () => "HOME-" + Math.random().toString(36).substring(2,6).toUpperCase();
const CAT_COLORS = {
  "Groceries":{bg:"#dcfce7",color:"#16a34a"},"Utilities":{bg:"#fff7ed",color:"#ea580c"},
  "Rent":{bg:"#f1f5f9",color:"#475569"},"Internet":{bg:"#eff6ff",color:"#2563eb"},
  "Transport":{bg:"#fef9c3",color:"#ca8a04"},"Dining Out":{bg:"#fdf2f8",color:"#a21caf"},
  "Subscriptions":{bg:"#dbeafe",color:"#1d4ed8"},"Healthcare":{bg:"#fff1f2",color:"#e11d48"},
  "Household":{bg:"#f0fdf4",color:"#15803d"},"Other":{bg:"#f8fafc",color:"#64748b"},
};
const getCatStyle = (name) => CAT_COLORS[name]||{bg:"#f1f5f9",color:"#475569"};
const labelStyle = {fontSize:12,fontWeight:600,color:"#64748b",marginBottom:6,display:"block"};
const inputStyle = {width:"100%",boxSizing:"border-box",padding:"13px 14px",border:"1.5px solid #e2e8f0",borderRadius:12,fontSize:15,background:"white",color:"#0f172a",outline:"none",fontFamily:"inherit"};
const btnDark = {flex:1,padding:"12px",borderRadius:12,border:"none",background:"#0f172a",color:"white",fontWeight:700,fontSize:14,cursor:"pointer"};
const btnOutline = {flex:1,padding:"12px",borderRadius:12,border:"1.5px solid #e2e8f0",background:"white",color:"#0f172a",fontWeight:600,fontSize:14,cursor:"pointer"};
const btnDanger = {padding:"12px 16px",borderRadius:12,border:"none",background:"#fff1f2",color:"#e11d48",fontWeight:600,fontSize:14,cursor:"pointer"};

// ── ROOT ─────────────────────────────────────────────────────────
export default function App() {
  const [session,setSession]=useState(null);
  const [myPerson,setMyPerson]=useState(null);
  const [myHouse,setMyHouse]=useState(null);
  const [authState,setAuthState]=useState("loading");
  // loading|auth|create_house|join_house|pending|suspended|house_suspended|approved|house_admin|super_admin

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setSession(session);
      if(session) checkUser(session.user);
      else setAuthState("auth");
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>{
      setSession(session);
      if(session) checkUser(session.user);
      else{setMyPerson(null);setMyHouse(null);setAuthState("auth");}
    });
    return ()=>subscription.unsubscribe();
  },[]);

  const checkUser=async(user)=>{
    // Super admin check
    if(user.email===SUPER_ADMIN_EMAIL){
      setAuthState("super_admin");
      return;
    }
    // Check if person exists
    const {data:person}=await supabase.from("persons").select("*, houses(*)").eq("user_id",user.id).single();
    if(person){
      setMyPerson(person);
      setMyHouse(person.houses);
      if(person.suspended){setAuthState("suspended");return;}
      if(person.houses?.status==="suspended"){setAuthState("house_suspended");return;}
      if(!person.is_approved){setAuthState("pending");return;}
      if(person.is_house_admin){setAuthState("house_admin");return;}
      setAuthState("approved");
    } else {
      // Check pending
      const {data:pending}=await supabase.from("pending_users").select("*").eq("user_id",user.id).single();
      if(pending) setAuthState("pending");
      else setAuthState("create_house"); // New user — create or join
    }
  };

  const signOut=()=>supabase.auth.signOut();
  const refresh=()=>{ if(session) checkUser(session.user); };
  const [showProfile,setShowProfile]=useState(false);

  if(authState==="loading") return <Splash/>;
  if(authState==="auth") return <AuthScreen/>;
  if(authState==="create_house") return <OnboardScreen user={session?.user} onDone={refresh}/>;
  if(authState==="pending") return <PendingScreen email={session?.user?.email} house={myHouse} onSignOut={signOut} onRefresh={refresh}/>;
  if(authState==="suspended") return <SuspendedScreen msg="Your account has been suspended by your house admin." onSignOut={signOut}/>;
  if(authState==="house_suspended") return <SuspendedScreen msg="Your house has been suspended by MyHouseExpenses. Please contact support." onSignOut={signOut}/>;
  if(authState==="super_admin") return <SuperAdminApp user={session?.user} onSignOut={signOut}/>;
  return <HouseApp myPerson={myPerson} myHouse={myHouse} isAdmin={authState==="house_admin"} onSignOut={signOut} onProfileUpdate={(p)=>setMyPerson(p)}/>;
}

// ── SPLASH ───────────────────────────────────────────────────────
function Splash(){
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0f172a",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{textAlign:"center",color:"white"}}>
        <div style={{fontSize:40,marginBottom:12}}>🏠</div>
        <div style={{fontSize:24,fontWeight:800,letterSpacing:"-0.5px"}}>MyHouseExpenses</div>
        <div style={{marginTop:24,width:28,height:28,border:"3px solid rgba(255,255,255,0.2)",borderTopColor:"white",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"24px auto 0"}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

// ── AUTH ─────────────────────────────────────────────────────────
function AuthScreen(){
  const [mode,setMode]=useState("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  // Friendly error messages
  const friendlyError=(msg)=>{
    if(!msg) return "Something went wrong. Please try again.";
    if(msg.includes("Invalid login credentials")) return "❌ Incorrect email or password. Please try again.";
    if(msg.includes("Email not confirmed")) return "📧 Please confirm your email before logging in.";
    if(msg.includes("User already registered")) return "⚠️ An account with this email already exists. Try logging in instead.";
    if(msg.includes("Password should be")) return "🔒 Password must be at least 6 characters long.";
    if(msg.includes("Unable to validate email")) return "📧 Please enter a valid email address.";
    if(msg.includes("signup is disabled")) return "⚠️ Sign ups are currently disabled. Contact the admin.";
    if(msg.includes("network") || msg.includes("fetch")) return "🌐 No internet connection. Please check your connection and try again.";
    return msg;
  };

  const validate=()=>{
    if(!email.trim()) return "Please enter your email address.";
    if(!email.includes("@")) return "Please enter a valid email address.";
    if(!password) return "Please enter your password.";
    if(mode==="signup" && password.length < 6) return "Password must be at least 6 characters.";
    return null;
  };

  const submit=async()=>{
    const validationError=validate();
    if(validationError){setError(validationError);return;}
    setError("");setLoading(true);
    if(mode==="login"){
      const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
      if(error)setError(friendlyError(error.message));
    } else {
      const{error}=await supabase.auth.signUp({email:email.trim(),password});
      if(error)setError(friendlyError(error.message));
    }
    setLoading(false);
  };

  const [showPassword,setShowPassword]=useState(false);
  const [forgotSent,setForgotSent]=useState(false);

  const forgotPassword=async()=>{
    if(!email.trim()||!email.includes("@"))return setError("Please enter your email address first.");
    const{error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:"https://myhouseexpenses.vercel.app"});
    if(error)setError(friendlyError(error.message));
    else setForgotSent(true);
  };

  return(
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{fontSize:48,marginBottom:12}}>🏠</div>
          <div style={{fontSize:28,fontWeight:800,color:"white",letterSpacing:"-0.5px"}}>MyHouseExpenses</div>
          <div style={{fontSize:14,color:"#94a3b8",marginTop:6}}>Split bills with your housemates</div>
        </div>
        <div style={{background:"white",borderRadius:20,padding:"28px 24px"}}>
          <h2 style={{margin:"0 0 20px",fontSize:18,fontWeight:700}}>{mode==="login"?"Welcome back":"Get started"}</h2>

          {forgotSent&&<div style={{background:"#f0fdf4",color:"#16a34a",borderRadius:10,padding:"10px 14px",fontSize:13,marginBottom:14,fontWeight:500}}>📧 Password reset email sent! Check your inbox.</div>}
          {error&&<div style={{background:"#fff1f2",color:"#e11d48",borderRadius:10,padding:"10px 14px",fontSize:13,marginBottom:14,fontWeight:500}}>{error}</div>}

          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} placeholder="you@email.com" style={{...inputStyle,borderColor:error&&!email?"#e11d48":"#e2e8f0"}} onKeyDown={e=>e.key==="Enter"&&submit()}/>
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <div style={{position:"relative"}}>
                <input type={showPassword?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("");}} placeholder="••••••••" style={{...inputStyle,paddingRight:48,borderColor:error&&!password?"#e11d48":"#e2e8f0"}} onKeyDown={e=>e.key==="Enter"&&submit()}/>
                <button onClick={()=>setShowPassword(!showPassword)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",border:"none",background:"transparent",cursor:"pointer",color:"#94a3b8",fontSize:13,fontWeight:500}}>
                  {showPassword?"Hide":"Show"}
                </button>
              </div>
            </div>
          </div>

          <button onClick={submit} disabled={loading} style={{width:"100%",marginTop:20,padding:"14px",borderRadius:14,border:"none",background:"#0f172a",color:"white",fontSize:15,fontWeight:700,cursor:"pointer",opacity:loading?0.7:1}}>
            {loading?"Please wait…":mode==="login"?"Log In":"Create Account"}
          </button>

          {mode==="login"&&(
            <button onClick={forgotPassword} style={{width:"100%",marginTop:8,padding:"8px",border:"none",background:"transparent",fontSize:13,color:"#94a3b8",cursor:"pointer"}}>
              Forgot password?
            </button>
          )}

          <button onClick={()=>{setMode(mode==="login"?"signup":"login");setError("");setForgotSent(false);}} style={{width:"100%",marginTop:4,padding:"10px",border:"none",background:"transparent",fontSize:14,color:"#64748b",cursor:"pointer"}}>
            {mode==="login"?"New here? Create account":"Already have an account? Log in"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ONBOARD (create or join house) ───────────────────────────────
function OnboardScreen({user,onDone}){
  const urlCode=new URLSearchParams(window.location.search).get("code")||"";
  const [screen,setScreen]=useState(urlCode?"join":"choose"); // choose|create|join
  const [houseName,setHouseName]=useState("");
  const [myName,setMyName]=useState("");
  const [joinCode,setJoinCode]=useState(urlCode);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");

  const createHouse=async()=>{
    if(!houseName.trim()||!myName.trim())return setError("Please fill in all fields.");
    setLoading(true);setError("");
    const code=generateCode();
    const{data:house,error:hErr}=await supabase.from("houses").insert([{name:houseName.trim(),join_code:code}]).select().single();
    if(hErr){setError(hErr.message);setLoading(false);return;}
    const color=PERSON_COLORS[0];
    await supabase.from("persons").insert([{house_id:house.id,user_id:user.id,name:myName.trim(),email:user.email,color,is_house_admin:true,is_approved:true}]);
    setLoading(false);
    onDone();
  };

  const joinHouse=async()=>{
    if(!myName.trim()||!joinCode.trim())return setError("Please fill in all fields.");
    setLoading(true);setError("");
    const{data:house}=await supabase.from("houses").select("*").eq("join_code",joinCode.trim().toUpperCase()).single();
    if(!house){setError("Invalid join code. Check with your house admin.");setLoading(false);return;}
    if(house.status==="suspended"){setError("This house is currently suspended.");setLoading(false);return;}
    // Add to pending
    await supabase.from("pending_users").insert([{user_id:user.id,email:user.email,house_id:house.id,join_code:joinCode.trim().toUpperCase()}]);
    // Create person (unapproved)
    const color=PERSON_COLORS[Math.floor(Math.random()*PERSON_COLORS.length)];
    await supabase.from("persons").insert([{house_id:house.id,user_id:user.id,name:myName.trim(),email:user.email,color,is_approved:false}]);
    setLoading(false);
    onDone();
  };

  if(screen==="choose") return(
    <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:10}}>🏠</div>
          <div style={{fontSize:22,fontWeight:800,color:"white"}}>MyHouseExpenses</div>
          <div style={{fontSize:14,color:"#94a3b8",marginTop:6}}>What would you like to do?</div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <button onClick={()=>setScreen("create")} style={{background:"white",borderRadius:16,padding:"20px",border:"none",cursor:"pointer",textAlign:"left"}}>
            <div style={{fontSize:24,marginBottom:8}}>🏡</div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Create a House</div>
            <div style={{fontSize:13,color:"#64748b"}}>Set up a new house and invite your housemates</div>
          </button>
          <button onClick={()=>setScreen("join")} style={{background:"white",borderRadius:16,padding:"20px",border:"none",cursor:"pointer",textAlign:"left"}}>
            <div style={{fontSize:24,marginBottom:8}}>🔑</div>
            <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>Join a House</div>
            <div style={{fontSize:13,color:"#64748b"}}>Enter a join code from your house admin</div>
          </button>
        </div>
        <button onClick={()=>supabase.auth.signOut()} style={{width:"100%",marginTop:16,padding:"10px",border:"none",background:"transparent",fontSize:13,color:"#64748b",cursor:"pointer"}}>Sign out</button>
      </div>
    </div>
  );

  if(screen==="create") return(
    <div style={{minHeight:"100vh",background:"#f4f4f0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{background:"white",borderRadius:20,padding:"28px 24px"}}>
          <button onClick={()=>setScreen("choose")} style={{border:"none",background:"none",cursor:"pointer",color:"#64748b",fontSize:13,marginBottom:16,padding:0}}>← Back</button>
          <h2 style={{margin:"0 0 6px",fontSize:20,fontWeight:700}}>Create your house</h2>
          <p style={{margin:"0 0 20px",fontSize:13,color:"#64748b"}}>You'll become the house admin and get a join code to share.</p>
          {error&&<div style={{background:"#fff1f2",color:"#e11d48",borderRadius:10,padding:"10px 14px",fontSize:13,marginBottom:14}}>{error}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><label style={labelStyle}>House name</label><input value={houseName} onChange={e=>setHouseName(e.target.value)} placeholder="e.g. The Lads Dublin 8" style={inputStyle}/></div>
            <div><label style={labelStyle}>Your name</label><input value={myName} onChange={e=>setMyName(e.target.value)} placeholder="e.g. Mingmar" style={inputStyle}/></div>
          </div>
          <button onClick={createHouse} disabled={loading} style={{...btnDark,width:"100%",marginTop:20,padding:"14px"}}>
            {loading?"Creating…":"Create House 🏡"}
          </button>
        </div>
      </div>
    </div>
  );

  return(
    <div style={{minHeight:"100vh",background:"#f4f4f0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{background:"white",borderRadius:20,padding:"28px 24px"}}>
          <button onClick={()=>setScreen("choose")} style={{border:"none",background:"none",cursor:"pointer",color:"#64748b",fontSize:13,marginBottom:16,padding:0}}>← Back</button>
          <h2 style={{margin:"0 0 6px",fontSize:20,fontWeight:700}}>Join a house</h2>
          <p style={{margin:"0 0 20px",fontSize:13,color:"#64748b"}}>Enter the join code shared by your house admin.</p>
          {error&&<div style={{background:"#fff1f2",color:"#e11d48",borderRadius:10,padding:"10px 14px",fontSize:13,marginBottom:14}}>{error}</div>}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><label style={labelStyle}>Join code</label><input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase())} placeholder="HOME-XXXX" style={{...inputStyle,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"monospace",fontSize:18}}/></div>
            <div><label style={labelStyle}>Your name</label><input value={myName} onChange={e=>setMyName(e.target.value)} placeholder="e.g. Pujit" style={inputStyle}/></div>
          </div>
          <button onClick={joinHouse} disabled={loading} style={{...btnDark,width:"100%",marginTop:20,padding:"14px"}}>
            {loading?"Joining…":"Request to Join 🔑"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PENDING ───────────────────────────────────────────────────────
function PendingScreen({email,house,onSignOut,onRefresh}){
  return(
    <div style={{minHeight:"100vh",background:"#f4f4f0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{background:"white",borderRadius:20,padding:"32px 24px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>⏳</div>
          <h2 style={{margin:"0 0 10px",fontSize:20,fontWeight:700}}>Waiting for approval</h2>
          <p style={{margin:"0 0 6px",fontSize:14,color:"#64748b",lineHeight:1.6}}>Your request to join <strong>{house?.name||"the house"}</strong> is pending.</p>
          <p style={{margin:"0 0 24px",fontSize:13,color:"#94a3b8"}}>The house admin needs to approve you. Tap refresh once they do.</p>
          <button onClick={onRefresh} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#0f172a",color:"white",fontWeight:700,fontSize:15,cursor:"pointer",marginBottom:10}}>Refresh</button>
          <button onClick={onSignOut} style={{width:"100%",padding:"10px",border:"none",background:"transparent",fontSize:14,color:"#94a3b8",cursor:"pointer"}}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

function SuspendedScreen({msg,onSignOut}){
  return(
    <div style={{minHeight:"100vh",background:"#f4f4f0",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px",fontFamily:"'Inter',system-ui,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{background:"white",borderRadius:20,padding:"32px 24px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>🔒</div>
          <h2 style={{margin:"0 0 10px",fontSize:20,fontWeight:700}}>Access suspended</h2>
          <p style={{margin:"0 0 24px",fontSize:14,color:"#64748b",lineHeight:1.6}}>{msg}</p>
          <button onClick={onSignOut} style={{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"#0f172a",color:"white",fontWeight:700,fontSize:15,cursor:"pointer"}}>Sign out</button>
        </div>
      </div>
    </div>
  );
}

// ── HOUSE APP ─────────────────────────────────────────────────────
function HouseApp({myPerson,myHouse,isAdmin,onSignOut,onProfileUpdate}){
  const [view,setView]=useState("Bills");
  const [persons,setPersons]=useState([]);
  const [categories,setCategories]=useState([]);
  const [bills,setBills]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [toast,setToast]=useState(null);
  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(null),3000);};

  const loadAll=useCallback(async()=>{
    setLoading(true);
    const[{data:p},{data:c},{data:b}]=await Promise.all([
      supabase.from("persons").select("*").eq("house_id",myHouse.id).order("created_at"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("bills").select("*, persons(id,name,color), categories(id,name,icon)").eq("house_id",myHouse.id).order("bill_date",{ascending:false}),
    ]);
    setPersons(p||[]);setCategories(c||[]);setBills(b||[]);
    setLoading(false);
  },[myHouse.id]);

  useEffect(()=>{
    loadAll();

    // Real-time updates — refresh when anyone adds/edits/deletes a bill
    const billsSub=supabase
      .channel("bills-changes")
      .on("postgres_changes",{event:"*",schema:"public",table:"bills",filter:`house_id=eq.${myHouse.id}`},()=>loadAll())
      .on("postgres_changes",{event:"*",schema:"public",table:"persons",filter:`house_id=eq.${myHouse.id}`},()=>loadAll())
      .subscribe();

    return ()=>supabase.removeChannel(billsSub);
  },[loadAll]);

  const tabs=isAdmin
    ?[
      {id:"Bills",icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>},
      {id:"People",icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>},
      {id:"Admin",icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>},
      {id:"Report",icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>},
    ]
    :[
      {id:"Bills",icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="13" y2="14"/></svg>},
      {id:"People",icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>},
      {id:"Report",icon:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>},
    ];

  return(
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",minHeight:"100vh",background:"#f4f4f0",color:"#0f172a",position:"relative",paddingBottom:80}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

      {/* Header */}
      <div style={{background:"#f4f4f0",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:900,margin:"0 auto"}}>
        <div>
          <div style={{fontWeight:800,fontSize:18,letterSpacing:"-0.3px"}}>🏠 {myHouse.name}</div>
          <div style={{fontSize:11,color:"#94a3b8",fontWeight:500,marginTop:1}}>Code: {myHouse.join_code}</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <button onClick={loadAll} title="Refresh" style={{width:36,height:36,borderRadius:99,border:"1.5px solid #e2e8f0",background:"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          </button>
          <button onClick={()=>setShowProfile(true)} style={{display:"flex",alignItems:"center",gap:8,background:"white",border:"1.5px solid #e2e8f0",borderRadius:99,padding:"6px 12px 6px 6px",cursor:"pointer"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:myPerson?.color||"#0f172a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"white"}}>{initials(myPerson?.name)}</div>
            <span style={{fontSize:13,fontWeight:600,color:"#475569"}}>{myPerson?.name?.split(" ")[0]}{isAdmin?" 👑":""}</span>
          </button>
        </div>
      </div>

      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,padding:"10px 20px",borderRadius:20,fontSize:14,fontWeight:500,background:"#0f172a",color:"white",whiteSpace:"nowrap"}}>{toast}</div>}

      {loading?<div style={{textAlign:"center",padding:"4rem",color:"#94a3b8"}}>Loading…</div>
        :view==="Bills"?<BillsView bills={bills} persons={persons} categories={categories} myPerson={myPerson} myHouse={myHouse} reload={loadAll} showToast={showToast} onAdd={()=>setShowForm(true)}/>
        :view==="People"?<PeopleView persons={persons} bills={bills}/>
        :view==="Admin"?<HouseAdminView house={myHouse} persons={persons} bills={bills} categories={categories} reload={loadAll} showToast={showToast}/>
        :<ReportView bills={bills} persons={persons} categories={categories}/>
      }

      {view==="Bills"&&(
        <button onClick={()=>setShowForm(true)} style={{position:"fixed",bottom:90,right:20,width:56,height:56,borderRadius:16,background:"#0f172a",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 20px rgba(0,0,0,0.25)",zIndex:50}}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      )}

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"white",borderTop:"1px solid #f1f5f9",display:"flex",justifyContent:"center",zIndex:100}}>
        {tabs.map(tab=>(
          <button key={tab.id} onClick={()=>setView(tab.id)} style={{flex:1,padding:"12px 0 16px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,color:view===tab.id?"#0f172a":"#94a3b8"}}>
            {tab.icon}
            <span style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{tab.id}</span>
            {view===tab.id&&<div style={{width:20,height:2,borderRadius:1,background:"#0f172a",marginTop:-2}}/>}
          </button>
        ))}
      </div>

      {showForm&&(
        <div onClick={()=>setShowForm(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:"24px 24px 0 0",padding:"24px 20px",width:"100%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{width:40,height:4,borderRadius:2,background:"#e2e8f0",margin:"0 auto 20px"}}/>
            <BillForm myPerson={myPerson} myHouse={myHouse} categories={categories} onSave={async()=>{await loadAll();setShowForm(false);showToast("Bill added ✓");}} onCancel={()=>setShowForm(false)}/>
          </div>
        </div>
      )}

      {showProfile&&(
        <div onClick={()=>setShowProfile(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:"24px 24px 0 0",padding:"24px 20px",width:"100%",maxHeight:"92vh",overflowY:"auto"}}>
            <div style={{width:40,height:4,borderRadius:2,background:"#e2e8f0",margin:"0 auto 20px"}}/>
            <ProfileView myPerson={myPerson} onSave={async(updated)=>{onProfileUpdate(updated);setShowProfile(false);showToast("Profile updated ✓");}} onSignOut={onSignOut} onClose={()=>setShowProfile(false)}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── HOUSE ADMIN VIEW ─────────────────────────────────────────────
function HouseAdminView({house,persons,bills,categories,reload,showToast}){
  const [tab,setTab]=useState("pending");
  const [pending,setPending]=useState([]);
  const [loading,setLoading]=useState(true);
  const [editingPerson,setEditingPerson]=useState(null);
  const [editingBill,setEditingBill]=useState(null);

  const loadPending=async()=>{
    setLoading(true);
    const{data}=await supabase.from("pending_users").select("*").eq("house_id",house.id).order("created_at");
    setPending(data||[]);setLoading(false);
  };
  useEffect(()=>{loadPending();},[]);

  const approve=async(pu)=>{
    await supabase.from("persons").update({is_approved:true}).eq("user_id",pu.user_id).eq("house_id",house.id);
    await supabase.from("pending_users").delete().eq("id",pu.id);
    showToast("Approved ✓");loadPending();reload();
  };

  const reject=async(pu)=>{
    if(!confirm(`Reject ${pu.email}?`))return;
    await supabase.from("persons").delete().eq("user_id",pu.user_id).eq("house_id",house.id);
    await supabase.from("pending_users").delete().eq("id",pu.id);
    showToast("Rejected");loadPending();reload();
  };

  const toggleSuspend=async(p)=>{
    if(!confirm(p.suspended?`Restore ${p.name}?`:`Suspend ${p.name}?`))return;
    await supabase.from("persons").update({suspended:!p.suspended}).eq("id",p.id);
    showToast(p.suspended?`${p.name} restored`:`${p.name} suspended`);reload();
  };

  const removePerson=async(p)=>{
    if(!confirm(`Remove ${p.name}? Their bills will remain.`))return;
    await supabase.from("persons").update({user_id:null,email:null,is_approved:false,suspended:false}).eq("id",p.id);
    showToast(`${p.name} removed`);reload();
  };

  const deleteBill=async(b)=>{
    if(!confirm(`Delete "${b.merchant}"?`))return;
    await supabase.from("bills").delete().eq("id",b.id);
    showToast("Bill deleted");reload();
  };

  const approvedPersons=persons.filter(p=>p.is_approved);
  const [showInvite,setShowInvite]=useState(false);
  const [copied,setCopied]=useState(false);
  const appUrl="https://myhouseexpenses.vercel.app";
  const inviteLink=`${appUrl}?code=${house.join_code}`;
  const inviteMsg=`Hey! I'm using MyHouseExpenses to track our shared bills. Join our house "${house.name}" using this link:\n\n${inviteLink}\n\nOr enter the code manually: ${house.join_code}`;

  const copyLink=async()=>{
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);setTimeout(()=>setCopied(false),2000);
  };
  const shareWhatsApp=()=>window.open(`https://wa.me/?text=${encodeURIComponent(inviteMsg)}`,"_blank");
  const shareEmail=()=>window.open(`mailto:?subject=Join our house on MyHouseExpenses&body=${encodeURIComponent(inviteMsg)}`,"_blank");

  return(
    <div style={{padding:"0 16px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
        <h2 style={{fontSize:22,fontWeight:700,margin:0}}>House Admin</h2>
        <div style={{background:"#f1f5f9",borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:700,color:"#475569",fontFamily:"monospace",letterSpacing:"0.1em"}}>{house.join_code}</div>
      </div>

      {/* Invite button */}
      <button onClick={()=>setShowInvite(!showInvite)} style={{width:"100%",marginBottom:16,padding:"13px",borderRadius:14,border:"none",background:"#0f172a",color:"white",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Invite Housemates
      </button>

      {/* Invite share sheet */}
      {showInvite&&(
        <div style={{background:"white",borderRadius:16,padding:"16px",marginBottom:16,border:"1.5px solid #e2e8f0"}}>
          <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>Share the join code with your housemates:</div>

          {/* Code display */}
          <div style={{background:"#f8fafc",borderRadius:12,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:11,color:"#94a3b8",fontWeight:600,marginBottom:4}}>JOIN CODE</div>
              <div style={{fontSize:24,fontWeight:800,fontFamily:"monospace",letterSpacing:"0.15em",color:"#0f172a"}}>{house.join_code}</div>
            </div>
            <button onClick={copyLink} style={{padding:"8px 14px",borderRadius:10,border:"none",background:copied?"#f0fdf4":"#0f172a",color:copied?"#16a34a":"white",fontWeight:600,fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>
              {copied?"✓ Copied!":"Copy Link"}
            </button>
          </div>

          {/* Share buttons */}
          <div style={{display:"flex",gap:10}}>
            <button onClick={shareWhatsApp} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#25d366",color:"white",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <button onClick={shareEmail} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#ea4335",color:"white",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Email
            </button>
          </div>

          <div style={{fontSize:12,color:"#94a3b8",marginTop:12,textAlign:"center"}}>Housemates enter the code when signing up to join your house</div>
        </div>
      )}

      <div style={{display:"flex",gap:8,marginBottom:20,background:"#e2e8f0",borderRadius:12,padding:4}}>
        {[
          {id:"pending",label:`Pending${pending.length>0?` (${pending.length})`:""}`},
          {id:"members",label:"Members"},
          {id:"bills",label:"Bills"},
        ].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,padding:"9px",borderRadius:9,border:"none",background:tab===t.id?"white":"transparent",fontWeight:600,fontSize:13,cursor:"pointer",color:tab===t.id?"#0f172a":"#64748b"}}>{t.label}</button>
        ))}
      </div>

      {/* PENDING */}
      {tab==="pending"&&(
        loading?<div style={{textAlign:"center",padding:"2rem",color:"#94a3b8"}}>Loading…</div>
        :pending.length===0?(
          <div style={{background:"white",borderRadius:16,padding:"32px",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:12}}>✅</div>
            <div style={{fontWeight:600,fontSize:16}}>No pending requests</div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {pending.map(pu=>{
              const person=persons.find(p=>p.user_id===pu.user_id);
              return(
                <div key={pu.id} style={{background:"white",borderRadius:16,padding:"16px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <div style={{width:42,height:42,borderRadius:"50%",background:"#fef9c3",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>⏳</div>
                    <div>
                      <div style={{fontWeight:600,fontSize:15}}>{person?.name||pu.email}</div>
                      <div style={{fontSize:12,color:"#94a3b8"}}>{pu.email} · {new Date(pu.created_at).toLocaleDateString("en-IE",{day:"numeric",month:"short"})}</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={()=>approve(pu)} style={btnDark}>✓ Approve</button>
                    <button onClick={()=>reject(pu)} style={btnDanger}>✕ Reject</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* MEMBERS */}
      {tab==="members"&&(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {approvedPersons.map(p=>(
            <div key={p.id} style={{background:"white",borderRadius:16,padding:"16px",opacity:p.suspended?0.7:1}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:42,height:42,borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"white",flexShrink:0}}>{initials(p.name)}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:15}}>{p.name}{p.is_house_admin?" 👑":""}{p.suspended?" 🔒":""}</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>{p.email||"No email"}</div>
                </div>
              </div>
              {editingPerson?.id===p.id?(
                <EditPersonForm person={p} onSave={async(u)=>{await supabase.from("persons").update(u).eq("id",p.id);setEditingPerson(null);showToast("Updated ✓");reload();}} onCancel={()=>setEditingPerson(null)}/>
              ):(
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button onClick={()=>setEditingPerson(p)} style={btnOutline}>✏️ Edit</button>
                  {!p.is_house_admin&&<>
                    <button onClick={()=>toggleSuspend(p)} style={p.suspended?btnDark:btnOutline}>{p.suspended?"▶ Restore":"⏸ Suspend"}</button>
                    <button onClick={()=>removePerson(p)} style={btnDanger}>🗑</button>
                  </>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* BILLS */}
      {tab==="bills"&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {bills.map(b=>(
            <div key={b.id} style={{background:"white",borderRadius:14,padding:"14px 16px"}}>
              {editingBill?.id===b.id?(
                <EditBillForm bill={b} persons={approvedPersons} categories={categories} onSave={async(u)=>{await supabase.from("bills").update(u).eq("id",b.id);setEditingBill(null);showToast("Updated ✓");reload();}} onCancel={()=>setEditingBill(null)}/>
              ):(
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:600,fontSize:14,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.merchant}</div>
                    <div style={{fontSize:12,color:"#94a3b8"}}>{b.persons?.name} · {new Date(b.bill_date+"T00:00:00").toLocaleDateString("en-IE",{day:"numeric",month:"short"})}</div>
                  </div>
                  <span style={{fontFamily:"monospace",fontWeight:700,fontSize:14}}>{fmt(b.amount)}</span>
                  <button onClick={()=>setEditingBill(b)} style={{width:30,height:30,border:"none",background:"#f1f5f9",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button onClick={()=>deleteBill(b)} style={{width:30,height:30,border:"none",background:"#fff1f2",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SUPER ADMIN APP ───────────────────────────────────────────────
function SuperAdminApp({user,onSignOut}){
  const [houses,setHouses]=useState([]);
  const [loading,setLoading]=useState(true);
  const [toast,setToast]=useState(null);
  const showToast=(msg)=>{setToast(msg);setTimeout(()=>setToast(null),3000);};

  const loadHouses=async()=>{
    setLoading(true);
    const{data}=await supabase.from("houses").select("*, persons(count), bills(count)").order("created_at",{ascending:false});
    setHouses(data||[]);setLoading(false);
  };
  useEffect(()=>{loadHouses();},[]);

  const toggleHouse=async(h)=>{
    const newStatus=h.status==="active"?"suspended":"active";
    if(!confirm(`${newStatus==="suspended"?"Suspend":"Restore"} "${h.name}"?`))return;
    await supabase.from("houses").update({status:newStatus}).eq("id",h.id);
    showToast(`House ${newStatus==="suspended"?"suspended":"restored"} ✓`);
    loadHouses();
  };

  const deleteHouse=async(h)=>{
    if(!confirm(`DELETE "${h.name}" permanently? All data will be lost.`))return;
    await supabase.from("houses").delete().eq("id",h.id);
    showToast("House deleted");loadHouses();
  };

  const appUrl="https://myhouseexpenses.vercel.app";
  const [showInvite,setShowInvite]=useState(false);
  const [copied,setCopied]=useState(false);
  const inviteMsg=`Hey! I'd like you to manage your house expenses using MyHouseExpenses.\n\nSign up here: ${appUrl}\n\n1. Create an account\n2. Click "Create a House"\n3. Invite your housemates using the join code\n\nIt's free and easy to use!`;
  const copyLink=async()=>{await navigator.clipboard.writeText(appUrl);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const shareWhatsApp=()=>window.open(`https://wa.me/?text=${encodeURIComponent(inviteMsg)}`,"_blank");
  const shareEmail=()=>window.open(`mailto:?subject=Manage your house expenses with MyHouseExpenses&body=${encodeURIComponent(inviteMsg)}`,"_blank");

  return(
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",minHeight:"100vh",background:"#0f172a",color:"white",padding:"0 0 40px"}}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <div style={{padding:"20px 20px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.1)"}}>
        <div>
          <div style={{fontWeight:800,fontSize:18}}>🏠 MyHouseExpenses</div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>Super Admin · {user?.email}</div>
        </div>
        <button onClick={onSignOut} style={{padding:"8px 14px",borderRadius:10,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"white",fontSize:13,cursor:"pointer"}}>Sign out</button>
      </div>

      {toast&&<div style={{position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:999,padding:"10px 20px",borderRadius:20,fontSize:14,fontWeight:500,background:"white",color:"#0f172a",whiteSpace:"nowrap"}}>{toast}</div>}

      <div style={{padding:"20px 16px"}}>

        <button onClick={()=>setShowInvite(!showInvite)} style={{width:"100%",marginBottom:16,padding:"13px",borderRadius:14,border:"none",background:"white",color:"#0f172a",fontWeight:700,fontSize:15,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Invite a House Admin
        </button>

        {showInvite&&(
          <div style={{background:"rgba(255,255,255,0.08)",borderRadius:16,padding:"16px",marginBottom:16,border:"1px solid rgba(255,255,255,0.15)"}}>
            <div style={{fontSize:13,color:"#94a3b8",marginBottom:12}}>Share MyHouseExpenses with someone who wants to manage their house:</div>
            <div style={{background:"rgba(255,255,255,0.05)",borderRadius:12,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{minWidth:0}}>
                <div style={{fontSize:11,color:"#94a3b8",fontWeight:600,marginBottom:4}}>APP LINK</div>
                <div style={{fontSize:14,fontWeight:700,color:"white",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{appUrl}</div>
              </div>
              <button onClick={copyLink} style={{padding:"8px 14px",borderRadius:10,border:"none",background:copied?"#22c55e":"white",color:copied?"white":"#0f172a",fontWeight:600,fontSize:13,cursor:"pointer",flexShrink:0}}>
                {copied?"✓ Copied!":"Copy"}
              </button>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={shareWhatsApp} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#25d366",color:"white",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </button>
              <button onClick={shareEmail} style={{flex:1,padding:"13px",borderRadius:12,border:"none",background:"#ea4335",color:"white",fontWeight:700,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Email
              </button>
            </div>
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:700}}>All Houses</h2>
          <span style={{background:"rgba(255,255,255,0.1)",borderRadius:99,padding:"4px 12px",fontSize:13,fontWeight:600}}>{houses.length} total</span>
        </div>

        {loading?<div style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>Loading…</div>
        :houses.length===0?<div style={{textAlign:"center",padding:"3rem",color:"#94a3b8"}}>No houses yet.</div>
        :(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {houses.map(h=>(
              <div key={h.id} style={{background:"rgba(255,255,255,0.05)",borderRadius:16,padding:"16px",border:h.status==="suspended"?"1px solid #ef4444":"1px solid rgba(255,255,255,0.1)"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:16,display:"flex",alignItems:"center",gap:8}}>
                      {h.name}
                      {h.status==="suspended"&&<span style={{fontSize:10,fontWeight:600,background:"#ef4444",color:"white",padding:"2px 8px",borderRadius:99}}>SUSPENDED</span>}
                    </div>
                    <div style={{fontSize:12,color:"#94a3b8",marginTop:2,fontFamily:"monospace",letterSpacing:"0.05em"}}>{h.join_code}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:16,marginBottom:14}}>
                  <div style={{fontSize:12,color:"#94a3b8"}}><span style={{fontWeight:700,color:"white",fontSize:16}}>{h.persons?.[0]?.count||0}</span> members</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}><span style={{fontWeight:700,color:"white",fontSize:16}}>{h.bills?.[0]?.count||0}</span> bills</div>
                  <div style={{fontSize:12,color:"#94a3b8"}}>Created {new Date(h.created_at).toLocaleDateString("en-IE",{day:"numeric",month:"short",year:"numeric"})}</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>toggleHouse(h)} style={{flex:1,padding:"10px",borderRadius:10,border:"1px solid rgba(255,255,255,0.2)",background:"transparent",color:"white",fontWeight:600,fontSize:13,cursor:"pointer"}}>
                    {h.status==="suspended"?"▶ Restore":"⏸ Suspend"}
                  </button>
                  <button onClick={()=>deleteHouse(h)} style={{padding:"10px 14px",borderRadius:10,border:"none",background:"#ef4444",color:"white",fontWeight:600,fontSize:13,cursor:"pointer"}}>🗑 Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



// ── PROFILE VIEW ─────────────────────────────────────────────────
function ProfileView({myPerson,onSave,onSignOut,onClose}){
  const [name,setName]=useState(myPerson?.name||"");
  const [revolut,setRevolut]=useState(myPerson?.revolut_link||"");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  const save=async()=>{
    if(!name.trim())return setError("Name cannot be empty.");
    setSaving(true);
    // Clean revolut link
    let revLink=revolut.trim();
    if(revLink&&!revLink.startsWith("http")){
      // Handle revolut.me/username format
      if(!revLink.includes("revolut.me")){
        revLink=`https://revolut.me/${revLink.replace("@","")}`;
      } else {
        revLink=`https://${revLink.replace("https://","")}`;
      }
    }
    const{data}=await supabase.from("persons").update({name:name.trim(),revolut_link:revLink||null}).eq("id",myPerson.id).select().single();
    setSaving(false);
    if(data) onSave(data);
  };

  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <h2 style={{margin:0,fontSize:20,fontWeight:700}}>My Profile</h2>
        <button onClick={onClose} style={{border:"none",background:"none",cursor:"pointer",color:"#94a3b8",fontSize:13}}>✕ Close</button>
      </div>

      {/* Avatar */}
      <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
        <div style={{width:64,height:64,borderRadius:"50%",background:myPerson?.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"white"}}>{initials(myPerson?.name)}</div>
      </div>

      {error&&<div style={{background:"#fff1f2",color:"#e11d48",borderRadius:10,padding:"10px 14px",fontSize:13,marginBottom:14}}>{error}</div>}

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div>
          <label style={labelStyle}>Your name</label>
          <input value={name} onChange={e=>setName(e.target.value)} style={inputStyle}/>
        </div>

        {/* Revolut link */}
        <div>
          <label style={labelStyle}>Your Revolut link</label>
          <div style={{position:"relative"}}>
            <div style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#94a3b8",pointerEvents:"none"}}>revolut.me/</div>
            <input
              value={revolut.replace("https://revolut.me/","").replace("revolut.me/","")}
              onChange={e=>{
                const val=e.target.value.replace("https://revolut.me/","").replace("revolut.me/","");
                setRevolut(val?"https://revolut.me/"+val:"");
              }}
              placeholder="yourusername"
              style={{...inputStyle,paddingLeft:100}}
            />
          </div>
          <div style={{fontSize:12,color:"#94a3b8",marginTop:6}}>
            Find your link in the Revolut app → Profile → Revolut link. Housemates will use this to pay you.
          </div>
        </div>

        {/* Preview */}
        {revolut&&(
          <div style={{background:"#eff6ff",borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#0666EB"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 1.97a3.828 3.828 0 010 5.414l1.97 1.97A6.789 6.789 0 0117.562 8.248zM12 15.827a3.828 3.828 0 110-7.655 3.828 3.828 0 010 7.655z"/></svg>
            <div>
              <div style={{fontSize:12,color:"#2563eb",fontWeight:600}}>Revolut link set</div>
              <div style={{fontSize:11,color:"#64748b"}}>{revolut}</div>
            </div>
          </div>
        )}
      </div>

      <button onClick={save} disabled={saving} style={{width:"100%",marginTop:20,padding:"14px",borderRadius:14,border:"none",background:"#0f172a",color:"white",fontSize:15,fontWeight:700,cursor:"pointer",opacity:saving?0.7:1}}>
        {saving?"Saving…":"Save Profile"}
      </button>

      <button onClick={onSignOut} style={{width:"100%",marginTop:10,padding:"12px",borderRadius:14,border:"1.5px solid #e2e8f0",background:"white",fontSize:14,fontWeight:600,cursor:"pointer",color:"#e11d48"}}>
        Sign Out
      </button>
    </div>
  );
}

// ── SETTLE UP BUTTON ─────────────────────────────────────────────
function SettleUpButton({persons,iOwe,myPerson,bills,myHouse,settlements,reload}){
  const [showSheet,setShowSheet]=useState(false);
  const [settlements,setSettlements]=useState([]);
  const [paying,setPaying]=useState(null); // person being paid
  const [marking,setMarking]=useState(false);

  const approved=persons.filter(p=>p.is_approved);
  const grandTotal=bills.reduce((s,b)=>s+Number(b.amount),0);
  const share=approved.length>0?grandTotal/approved.length:0;

  const creditors=approved.filter(p=>p.id!==myPerson?.id).map(p=>{
    const pTotal=bills.filter(b=>b.persons?.id===p.id).reduce((s,b)=>s+Number(b.amount),0);
    return {...p,paidExtra:pTotal-share};
  }).filter(p=>p.paidExtra>0).sort((a,b)=>b.paidExtra-a.paidExtra);

  const loadSettlements=async()=>{
    const{data}=await supabase.from("settlements")
      .select("*, from_person:from_person_id(name,color), to_person:to_person_id(name,color)")
      .eq("house_id",myHouse.id)
      .order("settled_at",{ascending:false})
      .limit(10);
    setSettlements(data||[]);
  };

  const openSheet=()=>{ loadSettlements(); setShowSheet(true); };

  const payByRevolut=(person)=>{
    const amount=Math.min(iOwe,person.paidExtra).toFixed(2);
    // If they have a revolut link use it, otherwise just open Revolut app
    if(person.revolut_link){
      const base=person.revolut_link.replace(/\/$/,"");
      window.open(`${base}/${amount}EUR`,"_blank");
    } else {
      // Open Revolut app directly
      window.open("https://revolut.com/app","_blank");
    }
    setPaying({person,amount:parseFloat(amount),method:"revolut"});
  };

  const markPaid=async(person,amount,method)=>{
    setMarking(true);
    await supabase.from("settlements").insert([{
      house_id:myHouse.id,
      from_person_id:myPerson.id,
      to_person_id:person.id,
      amount:parseFloat(amount),
      method
    }]);
    setMarking(false);
    setPaying(null);
    loadSettlements();
    reload();
  };

  const methodLabel=(m)=>m==="revolut"?"💜 Revolut":"💵 Cash";
  const methodColor=(m)=>m==="revolut"?"#7c3aed":"#16a34a";

  return(
    <>
      <button onClick={openSheet} style={{flex:1,padding:"13px",borderRadius:12,background:"white",border:"none",color:"#0f172a",fontWeight:700,fontSize:15,cursor:"pointer"}}>Settle Up</button>

      {showSheet&&(
        <div onClick={()=>{setShowSheet(false);setPaying(null);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end"}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:"24px 24px 0 0",padding:"24px 20px",width:"100%",maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{width:40,height:4,borderRadius:2,background:"#e2e8f0",margin:"0 auto 20px"}}/>
            <h2 style={{margin:"0 0 6px",fontSize:20,fontWeight:700}}>Settle Up</h2>
            <p style={{margin:"0 0 20px",fontSize:13,color:"#64748b"}}>Choose how you want to settle up</p>

            {/* Confirm payment after Revolut */}
            {paying&&(
              <div style={{background:"#f0f7ff",borderRadius:14,padding:"16px",marginBottom:16,border:"1.5px solid #bfdbfe"}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:6}}>Did you send the payment?</div>
                <div style={{fontSize:13,color:"#64748b",marginBottom:12}}>Mark as paid so your housemates know it's settled.</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>markPaid(paying.person,paying.amount,paying.method)} disabled={marking} style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:"#0f172a",color:"white",fontWeight:700,fontSize:14,cursor:"pointer"}}>
                    {marking?"Saving…":"✓ Yes, mark as paid"}
                  </button>
                  <button onClick={()=>setPaying(null)} style={{padding:"11px 14px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",fontWeight:600,fontSize:14,cursor:"pointer"}}>Not yet</button>
                </div>
              </div>
            )}

            {/* Who you owe */}
            {iOwe<=0?(
              <div style={{textAlign:"center",padding:"2rem",background:"#f0fdf4",borderRadius:14,marginBottom:16}}>
                <div style={{fontSize:32,marginBottom:8}}>🎉</div>
                <div style={{fontWeight:700,fontSize:16,color:"#16a34a"}}>You're all settled up!</div>
                <div style={{fontSize:13,color:"#64748b",marginTop:4}}>You don't owe anyone anything.</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>
                {creditors.map(p=>{
                  const amount=Math.min(iOwe,p.paidExtra);
                  return(
                    <div key={p.id} style={{background:"#f8fafc",borderRadius:14,padding:"14px 16px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                        <div style={{width:42,height:42,borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:"white"}}>{initials(p.name)}</div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:15}}>{p.name}</div>
                          <div style={{fontSize:12,color:"#64748b"}}>You will pay <span style={{fontWeight:700,color:"#e11d48"}}>{fmt(amount)}</span></div>
                        </div>
                      </div>
                      {/* Payment options */}
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>markPaid(p,amount,"cash")} disabled={marking} style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:"#16a34a",color:"white",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                          💵 Paid Cash
                        </button>
                        <button onClick={()=>payByRevolut(p)} style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:"#7c3aed",color:"white",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                          💜 Pay Revolut
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Settlement history */}
            {settlements.length>0&&(
              <>
                <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:"#94a3b8",marginBottom:10}}>RECENT SETTLEMENTS</div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {settlements.map(s=>(
                    <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#f8fafc",borderRadius:10}}>
                      <div style={{width:28,height:28,borderRadius:"50%",background:s.from_person?.color||"#94a3b8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white"}}>{initials(s.from_person?.name||"?")}</div>
                      <div style={{flex:1,fontSize:13}}>
                        <span style={{fontWeight:600}}>{s.from_person?.name}</span> paid <span style={{fontWeight:600}}>{s.to_person?.name}</span>
                      </div>
                      <span style={{fontSize:11,fontWeight:600,color:methodColor(s.method),background:s.method==="revolut"?"#f3e8ff":"#f0fdf4",padding:"3px 8px",borderRadius:99}}>{methodLabel(s.method)}</span>
                      <span style={{fontFamily:"monospace",fontWeight:700,fontSize:13}}>{fmt(s.amount)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={()=>{setShowSheet(false);setPaying(null);}} style={{width:"100%",marginTop:16,padding:"13px",borderRadius:12,border:"1.5px solid #e2e8f0",background:"white",fontSize:15,fontWeight:600,cursor:"pointer",color:"#475569"}}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── BILLS VIEW ───────────────────────────────────────────────────
function BillsView({bills,persons,categories,myPerson,myHouse,reload,showToast,onAdd}){
  const [filterPerson,setFilterPerson]=useState("");
  const [filterCat,setFilterCat]=useState("");
  const filtered=bills.filter(b=>{
    if(filterPerson&&b.persons?.id!==filterPerson)return false;
    if(filterCat&&b.categories?.id!==filterCat)return false;
    return true;
  });
  const grandTotal=bills.reduce((s,b)=>s+Number(b.amount),0);
  const myTotal=bills.filter(b=>b.persons?.id===myPerson?.id).reduce((s,b)=>s+Number(b.amount),0);
  const share=persons.length>0?grandTotal/persons.length:0;
  const theyOwe=Math.max(0,myTotal-share);
  const iOwe=Math.max(0,share-myTotal);
  return(
    <div>
      <div style={{margin:"0 16px 20px",borderRadius:20,background:"#0f172a",padding:"24px 20px",color:"white"}}>
        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",color:"#94a3b8",marginBottom:8}}>CURRENT BALANCE</div>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:20}}>
          <span style={{fontSize:42,fontWeight:700,letterSpacing:"-1px"}}>{fmt(Math.abs(iOwe-theyOwe))}</span>
          <span style={{fontSize:16,fontWeight:600,color:iOwe>theyOwe?"#f97316":"#22c55e"}}>{iOwe>theyOwe?"You will pay":"You will get"}</span>
        </div>
        <div style={{display:"flex",borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:16,marginBottom:20}}>
          <div style={{flex:1,borderRight:"1px solid rgba(255,255,255,0.1)",paddingRight:16}}>
            <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.08em",color:"#94a3b8",marginBottom:4}}>THEY OWE</div>
            <div style={{fontSize:18,fontWeight:700,fontFamily:"monospace"}}>{fmt(theyOwe)}</div>
          </div>
          <div style={{flex:1,paddingLeft:16}}>
            <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.08em",color:"#94a3b8",marginBottom:4}}>YOU OWE</div>
            <div style={{fontSize:18,fontWeight:700,fontFamily:"monospace"}}>{fmt(iOwe)}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <SettleUpButton persons={persons} iOwe={iOwe} myPerson={myPerson} bills={bills} myHouse={myHouse} settlements={settlements||[]} reload={reload}/>
          <button style={{flex:1,padding:"13px",borderRadius:12,background:"#1e293b",border:"none",color:"white",fontWeight:700,fontSize:15,cursor:"pointer"}}>Remind All</button>
        </div>
      </div>
      <div style={{overflowX:"auto",padding:"0 16px 12px",display:"flex",gap:8,scrollbarWidth:"none"}}>
        {[{id:"",name:"All people"},...persons.filter(p=>p.is_approved)].map(p=>(
          <button key={p.id} onClick={()=>setFilterPerson(p.id)} style={{flexShrink:0,padding:"10px 18px",borderRadius:99,border:"none",background:filterPerson===p.id?"#0f172a":"white",color:filterPerson===p.id?"white":"#475569",fontWeight:600,fontSize:14,cursor:"pointer",whiteSpace:"nowrap"}}>{p.name}</button>
        ))}
      </div>
      <div style={{overflowX:"auto",padding:"0 16px 20px",display:"flex",gap:8,scrollbarWidth:"none"}}>
        {[{id:"",name:"All categories"},...categories].map(c=>(
          <button key={c.id} onClick={()=>setFilterCat(c.id)} style={{flexShrink:0,padding:"10px 18px",borderRadius:99,border:"none",background:filterCat===c.id?"#0f172a":"white",color:filterCat===c.id?"white":"#475569",fontWeight:600,fontSize:14,cursor:"pointer",whiteSpace:"nowrap"}}>{c.name}</button>
        ))}
      </div>
      <div style={{padding:"0 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <span style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:"#94a3b8"}}>RECENT TRANSACTIONS</span>
          <span style={{fontSize:12,fontWeight:600,background:"#e2e8f0",color:"#475569",padding:"4px 10px",borderRadius:99}}>{filtered.length} bills</span>
        </div>
        {filtered.length===0?<div style={{textAlign:"center",padding:"3rem",color:"#94a3b8",fontSize:14}}>No bills yet. Tap + to add one!</div>:(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {filtered.map(b=><TransactionCard key={b.id} bill={b} persons={persons} allBills={bills}/>)}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionCard({bill,persons,allBills}){
  const c=bill.categories;const p=bill.persons;
  const cs=getCatStyle(c?.name);
  const [imgOpen,setImgOpen]=useState(false);
  const personTotal=allBills?allBills.filter(b=>b.persons?.id===p?.id).reduce((s,b)=>s+Number(b.amount),0):0;
  return(
    <>
      <div style={{background:"white",borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:52,height:52,borderRadius:14,background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <span style={{fontSize:11,fontWeight:800,color:cs.color,letterSpacing:"0.05em"}}>{catAbbr(c?.name)}</span>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{bill.merchant}</div>
          <div style={{fontSize:13,color:"#64748b"}}>{p?`${p.name} paid`:"Unknown"} · {new Date(bill.bill_date+"T00:00:00").toLocaleDateString("en-IE",{month:"short",day:"numeric"})}</div>
          {p&&personTotal>0&&<div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{p.name}'s total spend: <span style={{fontWeight:600,color:"#475569"}}>{fmt(personTotal)}</span></div>}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
          <span style={{fontWeight:700,fontSize:16,fontFamily:"monospace"}}>{fmtShort(bill.amount)}</span>
          <div style={{display:"flex"}}>
            {persons.filter(p=>p.is_approved).slice(0,3).map((person,i)=>(
              <div key={person.id} style={{width:22,height:22,borderRadius:"50%",background:person.color,border:"2px solid white",marginLeft:i>0?-6:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"white"}}>{initials(person.name)}</div>
            ))}
          </div>
        </div>
        {bill.image_url&&(
          <button onClick={()=>setImgOpen(true)} style={{width:32,height:32,border:"none",background:"#f1f5f9",borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          </button>
        )}
      </div>
      {imgOpen&&<div onClick={()=>setImgOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><img src={bill.image_url} alt="Receipt" style={{maxWidth:"100%",maxHeight:"80vh",borderRadius:12}}/></div>}
    </>
  );
}

function BillForm({myPerson,myHouse,categories,onSave,onCancel}){
  const today=new Date().toISOString().slice(0,10);
  const lastCat=localStorage.getItem("lastCategoryId")||"";
  const [form,setForm]=useState({merchant:"",amount:"",bill_date:today,category_id:lastCat,notes:""});
  const [imageFile,setImageFile]=useState(null);
  const [imagePreview,setImagePreview]=useState(null);
  const [saving,setSaving]=useState(false);
  const [amountInput,setAmountInput]=useState("");
  const fileRef=useRef();
  const padPress=(val)=>{
    if(val==="⌫"){const n=amountInput.slice(0,-1);setAmountInput(n);setForm(f=>({...f,amount:n}));}
    else if(val==="."&&amountInput.includes("."))return;
    else{const n=amountInput+val;setAmountInput(n);setForm(f=>({...f,amount:n}));}
  };
  const save=async()=>{
    if(!form.merchant||!form.amount)return alert("Please fill in merchant and amount.");
    setSaving(true);
    localStorage.setItem("lastCategoryId",form.category_id);
    let image_url=null;
    if(imageFile){
      const ext=imageFile.name.split(".").pop();
      const path=`${myHouse.id}/${Date.now()}.${ext}`;
      const{error}=await supabase.storage.from("bill-images").upload(path,imageFile);
      if(!error){const{data}=supabase.storage.from("bill-images").getPublicUrl(path);image_url=data.publicUrl;}
    }
    await supabase.from("bills").insert([{...form,amount:parseFloat(form.amount),image_url,house_id:myHouse.id,person_id:myPerson.id,category_id:form.category_id||null}]);
    setSaving(false);onSave();
  };
  return(
    <div>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:700}}>Add Bill</h2>
      <div style={{fontSize:13,color:"#64748b",marginBottom:20}}>Adding as <strong>{myPerson?.name}</strong></div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f){setImageFile(f);setImagePreview(URL.createObjectURL(f));}}}/>
      {imagePreview?(
        <div style={{position:"relative",borderRadius:14,overflow:"hidden",height:120,marginBottom:16}}>
          <img src={imagePreview} alt="Receipt" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          <button onClick={()=>fileRef.current?.click()} style={{position:"absolute",bottom:8,right:8,background:"rgba(0,0,0,0.65)",color:"white",border:"none",borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>Replace</button>
        </div>
      ):(
        <button onClick={()=>fileRef.current?.click()} style={{width:"100%",height:72,border:"2px dashed #e2e8f0",borderRadius:14,background:"#f8fafc",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,color:"#94a3b8",fontSize:13,fontWeight:500,marginBottom:16}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
          Attach receipt photo (optional)
        </button>
      )}
      <div style={{marginBottom:14}}><label style={labelStyle}>Merchant</label><input value={form.merchant} onChange={e=>setForm(f=>({...f,merchant:e.target.value}))} placeholder="e.g. Tesco, ESB Energy…" style={inputStyle}/></div>
      <div style={{marginBottom:12}}>
        <label style={labelStyle}>Amount (€)</label>
        <div style={{background:"#f8fafc",border:"1.5px solid #e2e8f0",borderRadius:12,padding:"14px 16px",fontSize:28,fontWeight:700,fontFamily:"monospace",color:amountInput?"#0f172a":"#cbd5e1",minHeight:58}}>{amountInput||"0.00"}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:8,marginBottom:16}}>
        {["1","2","3","4","5","6","7","8","9",".","0","⌫"].map(k=>(
          <button key={k} onClick={()=>padPress(k)} style={{padding:"16px",borderRadius:12,border:"1.5px solid #e2e8f0",background:k==="⌫"?"#fff1f2":"white",fontSize:k==="⌫"?18:20,fontWeight:600,cursor:"pointer",color:k==="⌫"?"#e11d48":"#0f172a"}}>{k}</button>
        ))}
      </div>
      <div style={{marginBottom:14}}><label style={labelStyle}>Date</label><input type="date" value={form.bill_date} onChange={e=>setForm(f=>({...f,bill_date:e.target.value}))} style={inputStyle}/></div>
      <div style={{marginBottom:16}}>
        <label style={labelStyle}>Category</label>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3, 1fr)",gap:8}}>
          {categories.map(c=>{const cs=getCatStyle(c.name);const sel=form.category_id===c.id;
            return <button key={c.id} onClick={()=>setForm(f=>({...f,category_id:c.id}))} style={{padding:"10px 6px",borderRadius:12,border:sel?`2px solid ${cs.color}`:"1.5px solid #e2e8f0",background:sel?cs.bg:"white",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <span style={{fontSize:18}}>{c.icon}</span>
              <span style={{fontSize:11,fontWeight:600,color:sel?cs.color:"#64748b"}}>{c.name}</span>
            </button>;
          })}
        </div>
      </div>
      <div style={{marginBottom:20}}><label style={labelStyle}>Notes (optional)</label><input value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any extra info…" style={inputStyle}/></div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onCancel} style={{...btnOutline,flex:1,padding:"14px"}}>Cancel</button>
        <button onClick={save} disabled={saving} style={{flex:2,padding:"14px",borderRadius:14,border:"none",background:"#0f172a",color:"white",fontSize:15,fontWeight:700,cursor:"pointer",opacity:saving?0.7:1}}>{saving?"Saving…":"Add Bill"}</button>
      </div>
    </div>
  );
}

function PeopleView({persons,bills}){
  const approved=persons.filter(p=>p.is_approved);
  const grandTotal=bills.reduce((s,b)=>s+Number(b.amount),0);
  return(
    <div style={{padding:"0 16px"}}>
      <h2 style={{fontSize:22,fontWeight:700,margin:"0 0 20px"}}>Housemates</h2>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {approved.map(p=>{
          const pTotal=bills.filter(b=>b.persons?.id===p.id).reduce((s,b)=>s+Number(b.amount),0);
          const share=approved.length>0?grandTotal/approved.length:0;
          const diff=pTotal-share;
          return(
            <div key={p.id} style={{background:"white",borderRadius:16,padding:"16px",opacity:p.suspended?0.5:1}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:46,height:46,borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,color:"white",flexShrink:0}}>{initials(p.name)}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:16}}>{p.name}{p.is_house_admin?" 👑":""}{p.suspended?" 🔒":""}</div>
                  <div style={{fontSize:13,color:"#64748b"}}>Paid {fmt(pTotal)}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:700,fontSize:15,color:diff>=0?"#16a34a":"#e11d48"}}>{diff>=0?"+":""}{fmt(diff)}</div>
                  <div style={{fontSize:11,color:"#94a3b8"}}>{diff>=0?"is owed":"owes"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReportView({bills,persons,categories}){
  const now=new Date();
  const [selMonth,setSelMonth]=useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`);
  const months=[...new Set(bills.map(b=>b.bill_date.slice(0,7)))].sort().reverse();
  const monthBills=bills.filter(b=>b.bill_date.startsWith(selMonth));
  const grandTotal=monthBills.reduce((s,b)=>s+Number(b.amount),0);
  const approved=persons.filter(p=>p.is_approved);
  const personTotals=approved.map(p=>({...p,total:monthBills.filter(b=>b.persons?.id===p.id).reduce((s,b)=>s+Number(b.amount),0)})).filter(p=>p.total>0);
  const catTotals=categories.map(c=>({...c,total:monthBills.filter(b=>b.categories?.id===c.id).reduce((s,b)=>s+Number(b.amount),0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);
  return(
    <div style={{padding:"0 16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <h2 style={{fontSize:22,fontWeight:700,margin:0}}>Monthly Report</h2>
        <select value={selMonth} onChange={e=>setSelMonth(e.target.value)} style={{padding:"8px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",background:"white",fontSize:13,fontWeight:600,color:"#0f172a",cursor:"pointer"}}>
          {months.length===0&&<option value={selMonth}>{monthLabel(...selMonth.split("-").map(Number))}</option>}
          {months.map(m=><option key={m} value={m}>{monthLabel(...m.split("-").map(Number))}</option>)}
        </select>
      </div>
      {monthBills.length===0?<div style={{textAlign:"center",padding:"3rem",color:"#94a3b8",fontSize:14}}>No bills for this month.</div>:(
        <>
          <div style={{background:"#0f172a",borderRadius:20,padding:"20px",marginBottom:16,color:"white"}}>
            <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.1em",color:"#94a3b8",marginBottom:6}}>TOTAL SPEND</div>
            <div style={{fontSize:36,fontWeight:700,letterSpacing:"-1px",marginBottom:16}}>{fmt(grandTotal)}</div>
            <div style={{display:"flex",gap:16}}>
              <div><div style={{fontSize:10,color:"#94a3b8",marginBottom:2}}>BILLS</div><div style={{fontWeight:700}}>{monthBills.length}</div></div>
              <div><div style={{fontSize:10,color:"#94a3b8",marginBottom:2}}>AVG BILL</div><div style={{fontWeight:700}}>{fmt(grandTotal/monthBills.length)}</div></div>
              {approved.length>0&&<div><div style={{fontSize:10,color:"#94a3b8",marginBottom:2}}>PER PERSON</div><div style={{fontWeight:700}}>{fmt(grandTotal/approved.length)}</div></div>}
            </div>
          </div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:"#94a3b8",marginBottom:10}}>BY HOUSEMATE</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {personTotals.map(p=>(
              <div key={p.id} style={{background:"white",borderRadius:14,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:34,height:34,borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"white"}}>{initials(p.name)}</div>
                  <span style={{fontWeight:600,flex:1}}>{p.name}</span>
                  <span style={{fontWeight:700,fontSize:16,fontFamily:"monospace"}}>{fmt(p.total)}</span>
                </div>
                <div style={{height:5,borderRadius:99,background:"#f1f5f9",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(p.total/grandTotal)*100}%`,background:p.color,borderRadius:99}}/>
                </div>
              </div>
            ))}
          </div>
          {catTotals.length>0&&<>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:"#94a3b8",marginBottom:10}}>BY CATEGORY</div>
            <div style={{background:"white",borderRadius:14,overflow:"hidden",marginBottom:20}}>
              {catTotals.map((c,i)=>{const cs=getCatStyle(c.name);return(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 16px",borderBottom:i<catTotals.length-1?"1px solid #f8fafc":"none"}}>
                  <div style={{width:36,height:36,borderRadius:10,background:cs.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:9,fontWeight:800,color:cs.color}}>{catAbbr(c.name)}</span></div>
                  <span style={{flex:1,fontSize:14,fontWeight:500}}>{c.name}</span>
                  <div style={{width:60,height:4,borderRadius:99,background:"#f1f5f9",overflow:"hidden",marginRight:8}}><div style={{height:"100%",width:`${(c.total/grandTotal)*100}%`,background:"#0f172a",borderRadius:99}}/></div>
                  <span style={{fontFamily:"monospace",fontSize:14,fontWeight:700,minWidth:65,textAlign:"right"}}>{fmt(c.total)}</span>
                </div>
              );})}
            </div>
          </>}
          {personTotals.length>1&&<>
            <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:"#94a3b8",marginBottom:10}}>FAIRNESS SPLIT</div>
            <div style={{background:"white",borderRadius:14,overflow:"hidden",marginBottom:20}}>
              {personTotals.map((p,i)=>{const diff=p.total-(grandTotal/personTotals.length);return(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"13px 16px",borderBottom:i<personTotals.length-1?"1px solid #f8fafc":"none"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"white"}}>{initials(p.name)}</div>
                  <span style={{flex:1,fontSize:14,fontWeight:500}}>{p.name}</span>
                  <span style={{fontFamily:"monospace",fontWeight:700,color:diff>=0?"#16a34a":"#e11d48"}}>{diff>=0?"+":""}{fmt(diff)}</span>
                </div>
              );})}
            </div>
          </>}
          <button onClick={()=>window.print()} style={{width:"100%",padding:"14px",borderRadius:14,border:"1.5px solid #e2e8f0",background:"white",fontSize:15,fontWeight:600,cursor:"pointer",color:"#0f172a",marginBottom:10}}>Print / Export PDF</button>
        </>
      )}
    </div>
  );
}

function EditPersonForm({person,onSave,onCancel}){
  const [name,setName]=useState(person.name);
  const [email,setEmail]=useState(person.email||"");
  const [color,setColor]=useState(person.color);
  return(
    <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:10}}>
      <div><label style={labelStyle}>Name</label><input value={name} onChange={e=>setName(e.target.value)} style={inputStyle}/></div>
      <div><label style={labelStyle}>Email</label><input value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle}/></div>
      <div><label style={labelStyle}>Colour</label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {PERSON_COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:28,height:28,borderRadius:"50%",background:c,border:color===c?"3px solid #0f172a":"2px solid white",cursor:"pointer",outline:color===c?"2px solid #0f172a":"none"}}/>)}
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>onSave({name,email,color})} style={btnDark}>Save</button>
        <button onClick={onCancel} style={btnOutline}>Cancel</button>
      </div>
    </div>
  );
}

function EditBillForm({bill,persons,categories,onSave,onCancel}){
  const [merchant,setMerchant]=useState(bill.merchant);
  const [amount,setAmount]=useState(String(bill.amount));
  const [date,setDate]=useState(bill.bill_date);
  const [personId,setPersonId]=useState(bill.persons?.id||"");
  const [categoryId,setCategoryId]=useState(bill.categories?.id||"");
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div><label style={labelStyle}>Merchant</label><input value={merchant} onChange={e=>setMerchant(e.target.value)} style={inputStyle}/></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><label style={labelStyle}>Amount (€)</label><input type="number" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} style={inputStyle}/></div>
        <div><label style={labelStyle}>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inputStyle}/></div>
      </div>
      <div><label style={labelStyle}>Paid by</label>
        <select value={personId} onChange={e=>setPersonId(e.target.value)} style={inputStyle}>
          {persons.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div><label style={labelStyle}>Category</label>
        <select value={categoryId} onChange={e=>setCategoryId(e.target.value)} style={inputStyle}>
          {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>onSave({merchant,amount:parseFloat(amount),bill_date:date,person_id:personId,category_id:categoryId})} style={btnDark}>Save</button>
        <button onClick={onCancel} style={btnOutline}>Cancel</button>
      </div>
    </div>
  );
}
