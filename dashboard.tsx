"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, AppWindow, ArrowUpRight, Bell, BookOpen, ChevronDown, Command,
  Cpu, Filter, Globe2, LayoutDashboard, Laptop, LogOut, Menu, Monitor,
  Palette, Plus, Search, Settings2, Shield, ShieldCheck, SlidersHorizontal,
  Sparkles, Users, Wifi, X, Moon, Sun, Check, AlertCircle
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  deviceCount: number; onlineCount: number; policyCount: number;
  whitelistCount: number; blockedDomainCount: number;
};
type School = { id: string; name: string };
type Profile = { name: string; role: string };
type Device = { id: string; device_name: string; status: string };
type Props = { stats: Stats; school: School | null; schoolOptions: School[]; devices: Device[]; profile: Profile };

const navigation = [
  { label: "Overview", icon: LayoutDashboard, key: "overview" },
  { label: "App whitelisting", icon: AppWindow, key: "apps" },
  { label: "Content filtering", icon: Globe2, key: "filtering" },
  { label: "Student management", icon: Users, key: "students" },
  { label: "Device branding", icon: Palette, key: "branding" },
];

const policyOptions = [
  { key: "lockdown_enabled", label: "Kiosk lockdown", description: "Enforce the configured restricted desktop shell.", icon: ShieldCheck, group: "System controls" },
  { key: "allow_task_manager", label: "Task Manager", description: "Allow students to open Windows Task Manager.", icon: Activity, group: "System controls", inverted: true },
  { key: "allow_control_panel", label: "Control Panel", description: "Allow access to classic system configuration.", icon: Settings2, group: "System controls", inverted: true },
  { key: "allow_settings", label: "Windows Settings", description: "Allow access to Windows Settings.", icon: SlidersHorizontal, group: "System controls", inverted: true },
  { key: "allow_powershell", label: "PowerShell", description: "Allow PowerShell command execution.", icon: Command, group: "System controls", inverted: true },
  { key: "allow_command_prompt", label: "Command Prompt", description: "Allow cmd.exe for student sessions.", icon: Cpu, group: "System controls", inverted: true },
  { key: "allow_usb_storage", label: "USB storage", description: "Allow removable USB storage devices.", icon: Laptop, group: "Device access", inverted: true },
  { key: "allow_windows_store", label: "Microsoft Store", description: "Allow Store app installation and access.", icon: AppWindow, group: "Device access", inverted: true },
  { key: "allow_task_switching", label: "Task switching", description: "Allow Alt+Tab and application switching.", icon: Monitor, group: "Device access", inverted: true },
  { key: "block_social_media", label: "Social media blocking", description: "Apply the school's social media domain rules.", icon: Globe2, group: "Web protection" },
  { key: "enforce_browser_profile", label: "Managed browser profile", description: "Require the managed student browser profile.", icon: Shield, group: "Web protection" },
] as const;

type PolicyKey = typeof policyOptions[number]["key"];
type Policy = Record<PolicyKey, boolean> & { id?: string; policy_version?: number };

const defaults: Policy = {
  lockdown_enabled: true, allow_task_manager: false, allow_control_panel: false,
  allow_settings: false, allow_powershell: false, allow_command_prompt: false,
  allow_usb_storage: false, allow_windows_store: false, allow_task_switching: false,
  block_social_media: true, enforce_browser_profile: true,
};

export default function Dashboard({ stats, school, schoolOptions, devices, profile }: Props) {
  const [active, setActive] = useState("overview");
  const [policy, setPolicy] = useState<Policy>(defaults);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [light, setLight] = useState(false);
  const [search, setSearch] = useState("");
  const supabase = useMemo(() => createClient(), []);
  const schoolId = school?.id;

  useEffect(() => {
    if (devices.length && !devices.some((device) => device.id === selectedDeviceId)) {
      setSelectedDeviceId(devices[0].id);
    }
    if (!devices.length) {
      setSelectedDeviceId("");
      setPolicyId(null);
      setPolicy(defaults);
    }
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    if (!schoolId || !selectedDeviceId) return;
    let alive = true;

    const loadPolicy = async () => {
      const { data, error } = await supabase
        .from("device_policies")
        .select("*")
        .eq("school_id", schoolId)
        .eq("device_id", selectedDeviceId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive) return;
      if (error) { setNotice("Unable to load device policy."); return; }
      if (data) {
        setPolicyId(data.id);
        setPolicy({ ...defaults, ...Object.fromEntries(
          Object.keys(defaults).map((key) => [key, data[key]])
        ) } as Policy);
      }
    };

    void loadPolicy();

    const channel = supabase
      .channel(`proca-policy-${schoolId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "device_policies",
        filter: `school_id=eq.${schoolId}`,
      }, (payload) => {
        if (payload.eventType === "DELETE") {
          setPolicyId(null); setPolicy(defaults); return;
        }
        const row = payload.new as Record<string, unknown>;
        if (row?.id && row.device_id === selectedDeviceId) {
          setPolicyId(String(row.id));
          setPolicy({ ...defaults, ...Object.fromEntries(
            Object.keys(defaults).map((key) => [key, row[key]])
          ) } as Policy);
        }
      })
      .subscribe();

    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [schoolId, selectedDeviceId, supabase]);

  async function updatePolicy(key: PolicyKey, value: boolean) {
    if (!schoolId || saving) return;
    const next = { ...policy, [key]: value };
    setPolicy(next);
    setSaving(true);
    setNotice("");

    const payload = { school_id: schoolId, device_id: selectedDeviceId, ...next };
    const result = policyId
      ? await supabase.from("device_policies").update(payload).eq("id", policyId).select("id").single()
      : await supabase.from("device_policies").insert(payload).select("id").single();

    if (result.error) {
      setPolicy(policy);
      setNotice(result.error.message);
    } else {
      if (!policyId && result.data?.id) setPolicyId(result.data.id);
      setNotice("Policy saved. Connected agents will receive the next policy version.");
    }
    setSaving(false);
  }

  const heading = navigation.find((item) => item.key === active)?.label ?? "Overview";
  const filteredPolicies = policyOptions.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className={light ? "app-shell light" : "app-shell"}>
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><ShieldCheck size={21} /></div>
          <div><div className="brand-name">PROCA<span>.</span></div><div className="brand-caption">CONTROL CENTER</div></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={18}/></button>
        </div>

        <div className="workspace-card">
          <div className="workspace-avatar"><BookOpen size={17}/></div>
          <div className="workspace-copy"><strong>{school?.name ?? "Platform workspace"}</strong><span>School workspace</span></div>
          <ChevronDown size={15} className="muted-icon"/>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list">
          {navigation.map((item) => {
            const Icon = item.icon;
            return <button key={item.key} className={`nav-item ${active === item.key ? "selected" : ""}`}
              onClick={() => { setActive(item.key); setMobileOpen(false); }}>
              <Icon size={18}/><span>{item.label}</span>{item.key === "apps" && <span className="nav-count">{stats.whitelistCount}</span>}
            </button>;
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="security-card"><div className="security-icon"><ShieldCheck size={17}/></div>
            <strong>Protected by design</strong><p>School-scoped access controls are active.</p>
            <span className="security-status"><i/> SECURITY ACTIVE</span>
          </div>
          <button className="nav-item"><Settings2 size={18}/><span>Settings</span></button>
          <div className="profile-row"><div className="profile-avatar">{profile.name.slice(0,1).toUpperCase()}</div>
            <div className="profile-copy"><strong>{profile.name}</strong><span>{profile.role.replaceAll("_"," ")}</span></div>
            <button className="icon-button" aria-label="Sign out" onClick={async () => { await supabase.auth.signOut(); window.location.assign("/login"); }}><LogOut size={17}/></button>
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)}/>}

      <section className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={20}/></button>
            <div className="breadcrumb">Workspace <span>/</span> <strong>{heading}</strong></div></div>
          <div className="topbar-actions"><div className="system-indicator"><i/> All systems operational</div>
            <button className="icon-button" onClick={() => setLight(!light)} aria-label="Toggle theme">{light ? <Moon size={18}/> : <Sun size={18}/>}</button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18}/><i/></button>
            <div className="topbar-avatar">{profile.name.slice(0,1).toUpperCase()}</div>
          </div>
        </header>

        <div className="content-wrap">
          <div className="welcome-row"><div><div className="eyebrow"><Sparkles size={13}/> SCHOOL DEVICE INTELLIGENCE</div>
            <h1>{active === "overview" ? "Good to see you." : heading}<span className="heading-period"> {active === "overview" ? "Let's secure your campus." : ""}</span></h1>
            <p className="page-subtitle">Monitor, configure and protect every managed Windows endpoint.</p></div>
            <div className="date-chip"><span className="live-pulse"/> LIVE CONTROL PLANE</div>
          </div>

          <div className="stats-grid">
            <StatCard label="Managed devices" value={stats.deviceCount} detail="Enrolled endpoints" icon={<Monitor size={18}/>} accent="cyan"/>
            <StatCard label="Devices online" value={stats.onlineCount} detail={stats.deviceCount ? `${Math.round(stats.onlineCount / stats.deviceCount * 100)}% of fleet` : "Awaiting enrollment"} icon={<Wifi size={18}/>} accent="green"/>
            <StatCard label="Active policies" value={stats.policyCount} detail="Device configurations" icon={<ShieldCheck size={18}/>} accent="violet"/>
            <StatCard label="Allowed applications" value={stats.whitelistCount} detail="Enabled whitelist rules" icon={<AppWindow size={18}/>} accent="blue"/>
          </div>

          {active === "overview" && <div className="overview-grid">
            <section className="panel fleet-panel"><div className="panel-heading"><div><div className="panel-kicker">FLEET TELEMETRY</div><h2>Device activity</h2></div><span className="panel-badge"><Activity size={13}/> LIVE</span></div>
              <div className="fleet-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="orbit-core"><Monitor size={27}/><strong>{stats.deviceCount}</strong><span>ENDPOINTS</span></div>
                <div className="orbit-node node-a"><span/><small>ONLINE</small><b>{stats.onlineCount}</b></div><div className="orbit-node node-b"><span/><small>OFFLINE</small><b>{Math.max(0,stats.deviceCount-stats.onlineCount)}</b></div></div>
              <div className="fleet-legend"><span><i className="legend-online"/> Online</span><span><i className="legend-offline"/> Offline / pending</span></div>
            </section>
            <section className="panel quick-panel"><div className="panel-heading"><div><div className="panel-kicker">QUICK ACCESS</div><h2>Control modules</h2></div><ArrowUpRight size={17} className="muted-icon"/></div>
              {navigation.slice(1).map((item) => { const Icon=item.icon; return <button key={item.key} className="quick-link" onClick={()=>setActive(item.key)}><span className="quick-icon"><Icon size={17}/></span><span><strong>{item.label}</strong><small>Configure school controls</small></span><ArrowUpRight size={15}/></button>; })}
            </section>
          </div>}

          {active === "apps" && <section className="panel module-panel"><ModuleHeader kicker="APPLICATION GOVERNANCE" title="App whitelisting" description="Define the Windows executables students are permitted to run."/>
            <div className="empty-state"><div className="empty-icon"><AppWindow size={25}/></div><h3>No application rules yet</h3><p>Whitelist entries are stored per school and later enforced by the signed Windows agent. Add an enrolled device and configure its policy before rollout.</p><button className="primary-button" onClick={()=>setNotice("Application rule editor is the next implementation step.")}><Plus size={16}/> Add application rule</button></div>
          </section>}

          {active === "filtering" && <section className="panel module-panel"><ModuleHeader kicker="WEB ACCESS GOVERNANCE" title="Content filtering" description="Manage blocked domains and web access categories for student devices."/>
            <div className="filter-summary"><div><Globe2 size={20}/><span><strong>{stats.blockedDomainCount}</strong><small>Active blocked domains</small></span></div><button className="primary-button" onClick={()=>setNotice("Domain management editor is the next implementation step.")}><Plus size={16}/> Add blocked domain</button></div>
            <div className="empty-state compact"><p>Domain rules are ready to be configured in the database. The browser enforcement component will be delivered with the Windows agent integration.</p></div>
          </section>}

          {active === "students" && <section className="panel module-panel"><ModuleHeader kicker="IDENTITY & ACCESS" title="Student management" description="Manage student identity, device assignments and managed sessions."/><div className="empty-state"><div className="empty-icon"><Users size={25}/></div><h3>Student directory foundation</h3><p>Your existing profiles table supports student roles. A dedicated student roster and device-assignment workflow is the next schema extension.</p></div></section>}

          {active === "branding" && <section className="panel module-panel"><ModuleHeader kicker="DEVICE EXPERIENCE" title="Device branding" description="Configure the visual identity shown on managed school computers."/><div className="branding-preview"><div className="preview-wallpaper"><div className="preview-logo"><ShieldCheck size={25}/></div><strong>{school?.name ?? "Your school"}</strong><span>LEARN. FOCUS. ACHIEVE.</span><div className="preview-time">08:30</div></div><div className="branding-meta"><strong>Lock-screen preview</strong><p>Branding assets are stored by school. Upload controls and secure Storage policies are next.</p></div></div></section>}

          {(active === "overview" || active === "apps" || active === "filtering") && <section className="panel policy-panel">
            <div className="panel-heading policy-heading"><div><div className="panel-kicker">POLICY CONFIGURATION</div><h2>App & system restrictions</h2><p>Choose which Windows capabilities students can access.</p>
              <select className="device-select" value={selectedDeviceId} onChange={(event)=>{setSelectedDeviceId(event.target.value);setPolicyId(null);setPolicy(defaults);}} disabled={!devices.length}>
                {devices.length ? devices.map((device)=><option key={device.id} value={device.id}>{device.device_name} · {device.status}</option>) : <option value="">No enrolled devices</option>}
              </select>
            </div><span className={`save-state ${saving ? "saving" : ""}`}><i/>{saving ? "SAVING" : "SYNC READY"}</span></div>
            <div className="policy-toolbar"><div className="policy-tabs"><span className="active-tab">All controls</span><span>System</span><span>Web</span></div><div className="search-field"><Search size={15}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Find a control..."/></div></div>
            <div className="policy-grid">{filteredPolicies.map((item) => { const Icon=item.icon; const enabled=policy[item.key]; return <article className={`policy-card ${enabled ? "policy-enabled" : ""}`} key={item.key}>
              <div className="policy-card-top"><span className="policy-icon"><Icon size={18}/></span><span className={`state-pill ${enabled ? "state-on" : "state-off"}`}><i/>{enabled ? (item.inverted ? "ALLOWED" : "ENFORCED") : (item.inverted ? "RESTRICTED" : "DISABLED")}</span></div>
              <div className="policy-copy"><h3>{item.label}</h3><p>{item.description}</p></div>
              <div className="policy-card-bottom"><span>{item.group}</span><button className={`toggle ${enabled ? "toggle-on" : ""}`} role="switch" aria-checked={enabled} aria-label={`Toggle ${item.label}`} disabled={saving || !schoolId || !selectedDeviceId} onClick={()=>void updatePolicy(item.key,!enabled)}><span/></button></div>
            </article>; })}</div>
            {!selectedDeviceId && <div className="inline-hint"><AlertCircle size={15}/> Enroll a Windows device to begin configuring its policy.</div>}
            {selectedDeviceId && !policyId && <div className="inline-hint"><AlertCircle size={15}/> No policy exists for this device yet. Your first change will create its initial policy.</div>}
          </section>}

          {notice && <div className="toast" role="status"><Check size={16}/>{notice}<button onClick={()=>setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
          <footer className="footer"><span>PROCA CONTROL PLANE <b>·</b> BUILD 0.1.0</span><span>SECURE BY DESIGN <ShieldCheck size={13}/></span></footer>
        </div>
      </section>
    </main>
  );
}

function StatCard({label,value,detail,icon,accent}:{label:string;value:number;detail:string;icon:React.ReactNode;accent:string}) {
  return <article className="stat-card"><div className={`stat-icon ${accent}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value.toLocaleString()}</div><div className="stat-detail">{detail}</div><div className={`stat-glow ${accent}`}/></article>;
}
function ModuleHeader({kicker,title,description}:{kicker:string;title:string;description:string}) {
  return <div className="module-header"><div className="panel-kicker">{kicker}</div><h2>{title}</h2><p>{description}</p></div>;
}
