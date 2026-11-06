import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) redirect("/login");

  const userId = claimsData.claims.sub;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, school_id, full_name, role")
    .eq("id", userId)
    .single();

  if (profileError || !profile) redirect("/login");

  const isPlatformAdmin = profile.role === "platform_admin";
  const schoolQuery = supabase.from("schools").select("id, name");
  const { data: schools } = isPlatformAdmin
    ? await schoolQuery.order("name")
    : await schoolQuery.eq("id", profile.school_id).limit(1);

  const activeSchool = schools?.[0] ?? null;

  let deviceCount = 0;
  let devices: { id: string; device_name: string; status: string }[] = [];
  let onlineCount = 0;
  let policyCount = 0;
  let whitelistCount = 0;
  let blockedDomainCount = 0;

  if (activeSchool) {
    const schoolId = activeSchool.id;
    const [deviceRows, online, policies, apps, domains] = await Promise.all([
      supabase.from("devices").select("id, device_name, status").eq("school_id", schoolId).order("device_name").limit(200),
      supabase.from("devices").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "online"),
      supabase.from("device_policies").select("*", { count: "exact", head: true }).eq("school_id", schoolId),
      supabase.from("app_whitelist").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("enabled", true),
      supabase.from("blocked_domains").select("*", { count: "exact", head: true }).eq("school_id", schoolId).eq("enabled", true),
    ]);
    devices = deviceRows.data ?? [];
    deviceCount = deviceRows.data?.length ?? 0;
    onlineCount = online.count ?? 0;
    policyCount = policies.count ?? 0;
    whitelistCount = apps.count ?? 0;
    blockedDomainCount = domains.count ?? 0;
  }

  return (
    <Dashboard
      profile={{ name: profile.full_name ?? "Administrator", role: profile.role }}
      school={activeSchool}
      stats={{ deviceCount, onlineCount, policyCount, whitelistCount, blockedDomainCount }}
      schoolOptions={schools ?? []}
      devices={devices}
    />
  );
}
