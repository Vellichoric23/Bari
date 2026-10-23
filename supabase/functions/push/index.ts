// BARI push reminders. Deploy in Supabase → Edge Functions → name "push", JWT verification OFF.
// GET ?key=1 → public VAPID key for the app. Any other call (pg_cron every minute) → send due reminders.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...cors, "content-type": "application/json" } });

async function vapid() {
  const { data } = await sb.from("push_keys").select("public_key, private_key").eq("id", 1).maybeSingle();
  if (data) return data;
  const k = webpush.generateVAPIDKeys();
  await sb.from("push_keys").insert({ id: 1, public_key: k.publicKey, private_key: k.privateKey });
  return { public_key: k.publicKey, private_key: k.privateKey };
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const keys = await vapid();
  const qs = new URL(req.url).searchParams;
  if (qs.has("key")) return json({ key: keys.public_key });

  webpush.setVapidDetails("mailto:bari-app@example.com", keys.public_key, keys.private_key);

  // diagnostics for one user: ?check=<user id> → what the server sees and a test push
  const check = qs.get("check");
  if (check) {
    const out: Record<string, unknown> = { now: new Date().toISOString(), version: 2 };
    const { data: subs, error: e1 } = await sb.from("docs").select("id, data").eq("col", "push").eq("user_id", check);
    out.subscriptions = subs?.length ?? 0; if (e1) out.subsError = e1.message;
    const { data: rems, error: e2 } = await sb.from("docs").select("id, data").eq("col", "remind").eq("user_id", check);
    if (e2) out.remindError = e2.message;
    const upcoming = (rems ?? []).flatMap((r) => (r.data?.items ?? []).map((i: { at: string; title: string }) => ({ at: i.at, title: i.title })))
      .filter((i) => Date.parse(i.at) > Date.now() - 15 * 60e3).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    out.reminders = upcoming.length; out.next = upcoming.slice(0, 3);
    const results: string[] = [];
    for (const s of subs ?? []) {
      try { await webpush.sendNotification(s.data, JSON.stringify({ title: "BARI: проверка", body: "Если ты это видишь — уведомления работают 🎉", tag: "test" })); results.push("ok"); }
      catch (e) { const er = e as { statusCode?: number; body?: string; message?: string }; results.push(`error ${er.statusCode ?? ""} ${er.body ?? er.message ?? e}`.slice(0, 300)); }
    }
    out.test = results;
    return json(out);
  }
  const now = Date.now();
  const days = [-1, 0, 1].map((o) => ymd(new Date(now + o * 864e5)));
  const { data: rems } = await sb.from("docs").select("user_id, id, data").eq("col", "remind").in("id", days);

  const due: { user: string; key: string; title: string; body: string }[] = [];
  for (const r of rems ?? []) {
    for (const it of (r.data?.items ?? [])) {
      const t = Date.parse(it.at);
      if (t <= now && t > now - 15 * 60e3) due.push({ user: r.user_id, key: `${r.user_id}|${it.key}`, title: it.title, body: it.body });
    }
  }
  if (!due.length) return json({ sent: 0 });

  const { data: done } = await sb.from("push_sent").select("k").in("k", due.map((d) => d.key));
  const already = new Set((done ?? []).map((x) => x.k));
  const todo = due.filter((d) => !already.has(d.key));
  if (!todo.length) return json({ sent: 0 });

  const users = [...new Set(todo.map((d) => d.user))];
  const { data: subs } = await sb.from("docs").select("user_id, id, data").eq("col", "push").in("user_id", users);
  let sent = 0;
  for (const d of todo) {
    for (const s of (subs ?? []).filter((x) => x.user_id === d.user)) {
      try {
        await webpush.sendNotification(s.data, JSON.stringify({ title: d.title, body: d.body, tag: d.key }));
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await sb.from("docs").delete().eq("user_id", s.user_id).eq("col", "push").eq("id", s.id);
      }
    }
  }
  await sb.from("push_sent").insert(todo.map((d) => ({ k: d.key })));
  await sb.from("push_sent").delete().lt("at", new Date(now - 3 * 864e5).toISOString());
  return json({ sent });
});
