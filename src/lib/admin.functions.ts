import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin.server";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    await sa.rpc("expire_activations");
    const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
    const [users, pending, flagged, withdrawals, activeActivations, paidOrders, rewards, audit] = await Promise.all([
      count(sa.from("profiles").select("user_id", { count: "exact", head: true })),
      count(sa.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending")),
      count(sa.from("submissions").select("id", { count: "exact", head: true }).eq("status", "flagged")),
      count(sa.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "requested")),
      count(sa.from("activations").select("id", { count: "exact", head: true }).eq("status", "active")),
      sa.from("orders").select("amount_kes").eq("status", "paid"),
      sa.from("wallet_transactions").select("amount_kes").in("type", ["reward", "referral_bonus"]),
      sa.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(12),
    ]);
    return {
      users,
      pendingSubmissions: pending,
      flaggedSubmissions: flagged,
      pendingWithdrawals: withdrawals,
      activeActivations,
      packageRevenueKes: (paidOrders.data ?? []).reduce((s, o) => s + o.amount_kes, 0),
      rewardsCreditedKes: (rewards.data ?? []).reduce((s, t) => s + t.amount_kes, 0),
      recentAudit: audit.data ?? [],
    };
  });

export const listSubmissionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["pending", "flagged", "approved", "rejected", "all"]).default("pending") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    let q = sa
      .from("submissions")
      .select("*, activation:activations(expires_at, approved_posts, package:packages(name, reward_per_post_kes, max_rewarded_posts)), campaign:campaigns(title)")
      .order("created_at", { ascending: true })
      .limit(100);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows } = await q;
    const list = rows ?? [];
    const userIds = [...new Set(list.map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await sa.from("profiles").select("user_id, full_name, email, phone").in("user_id", userIds)
      : { data: [] };
    const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));
    const signed = list.length
      ? await sa.storage.from("screenshots").createSignedUrls(list.map((r) => r.storage_path), 900)
      : { data: [] };
    const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
    // Count how many other submissions share this hash (duplicate evidence)
    const hashes = list.map((r) => r.file_sha256);
    const { data: dupRows } = hashes.length ? await sa.from("submissions").select("file_sha256").in("file_sha256", hashes) : { data: [] };
    const dupCount = new Map<string, number>();
    for (const d of dupRows ?? []) dupCount.set(d.file_sha256, (dupCount.get(d.file_sha256) ?? 0) + 1);
    return list.map((r) => ({
      ...r,
      user: byId.get(r.user_id) ?? null,
      previewUrl: urlByPath.get(r.storage_path) ?? null,
      duplicateCount: (dupCount.get(r.file_sha256) ?? 1) - 1,
    }));
  });

export const reviewSubmissionAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]), note: z.string().max(300).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    const { data: row, error } = await sa.rpc("review_submission", {
      p_reviewer: context.userId,
      p_submission_id: data.id,
      p_decision: data.decision,
      p_note: data.note ?? "",
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const listWithdrawalsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ status: z.enum(["requested", "paid", "rejected", "all"]).default("requested") }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    let q = sa.from("withdrawals").select("*").order("created_at", { ascending: true }).limit(100);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows } = await q;
    const list = rows ?? [];
    const ids = [...new Set(list.map((r) => r.user_id))];
    const [{ data: profiles }, { data: wallets }] = await Promise.all([
      ids.length ? sa.from("profiles").select("user_id, full_name, email").in("user_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? sa.from("wallets").select("*").in("user_id", ids) : Promise.resolve({ data: [] }),
    ]);
    const p = new Map((profiles ?? []).map((x) => [x.user_id, x]));
    const w = new Map((wallets ?? []).map((x) => [x.user_id, x]));
    return list.map((r) => ({ ...r, user: p.get(r.user_id) ?? null, wallet: w.get(r.user_id) ?? null }));
  });

export const processWithdrawalAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), decision: z.enum(["paid", "reject"]), note: z.string().max(300).optional(), receipt: z.string().max(40).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    const { data: row, error } = await sa.rpc("process_withdrawal", {
      p_admin: context.userId,
      p_withdrawal_id: data.id,
      p_decision: data.decision,
      p_note: data.note ?? "",
      p_receipt: data.receipt ?? "",
    });
    if (error) throw new Error(error.message);
    return row;
  });

export const listUsersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(80).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    let q = sa.from("profiles").select("*").order("created_at", { ascending: false }).limit(200);
    if (data.q) q = q.or(`full_name.ilike.%${data.q}%,email.ilike.%${data.q}%,phone.ilike.%${data.q}%`);
    const { data: profiles } = await q;
    const ids = (profiles ?? []).map((p) => p.user_id);
    const [{ data: wallets }, { data: roles }, { data: acts }] = await Promise.all([
      ids.length ? sa.from("wallets").select("*").in("user_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? sa.from("user_roles").select("*").in("user_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? sa.from("activations").select("user_id,status").in("user_id", ids).eq("status", "active") : Promise.resolve({ data: [] }),
    ]);
    const w = new Map((wallets ?? []).map((x) => [x.user_id, x]));
    const r = new Map<string, string[]>();
    for (const role of roles ?? []) r.set(role.user_id, [...(r.get(role.user_id) ?? []), role.role]);
    const a = new Map<string, number>();
    for (const act of acts ?? []) a.set(act.user_id, (a.get(act.user_id) ?? 0) + 1);
    return (profiles ?? []).map((p) => ({
      ...p,
      wallet: w.get(p.user_id) ?? null,
      roles: r.get(p.user_id) ?? [],
      activeCampaigns: a.get(p.user_id) ?? 0,
    }));
  });

export const setUserRoleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), makeAdmin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.makeAdmin) throw new Error("You cannot remove your own admin role.");
    const sa = await admin();
    if (data.makeAdmin) {
      await sa.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await sa.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }
    await sa.rpc("log_audit", {
      p_actor: context.userId,
      p_actor_type: "admin",
      p_action: data.makeAdmin ? "role.admin_granted" : "role.admin_revoked",
      p_entity_type: "user",
      p_entity_id: data.userId,
      p_meta: {},
    });
    return { ok: true };
  });

export const listOrdersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    const { data: orders } = await sa
      .from("orders")
      .select("*, package:packages(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    const ids = [...new Set((orders ?? []).map((o) => o.user_id))];
    const { data: profiles } = ids.length ? await sa.from("profiles").select("user_id, full_name, email").in("user_id", ids) : { data: [] };
    const p = new Map((profiles ?? []).map((x) => [x.user_id, x]));
    return (orders ?? []).map((o) => ({ ...o, user: p.get(o.user_id) ?? null }));
  });

export const getAdminSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    const [{ data: settings }, { data: packages }] = await Promise.all([
      sa.from("app_settings").select("*").order("key"),
      sa.from("packages").select("*").order("sort_order"),
    ]);
    const { getPaymentMode } = await import("@/lib/payments/mpesa.server");
    return { settings: settings ?? [], packages: packages ?? [], paymentMode: getPaymentMode() };
  });

export const updateSettingAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1).max(60), value: z.unknown() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    const { error } = await sa.from("app_settings").update({ value: data.value as never }).eq("key", data.key);
    if (error) throw new Error(error.message);
    await sa.rpc("log_audit", {
      p_actor: context.userId,
      p_actor_type: "admin",
      p_action: "settings.updated",
      p_entity_type: "setting",
      p_entity_id: data.key,
      p_meta: { key: data.key, value: data.value } as never,
    });
    return { ok: true };
  });

export const upsertPackageAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z.string().min(2).max(30).regex(/^[a-z0-9-]+$/),
        name: z.string().min(2).max(40),
        tagline: z.string().max(120).default(""),
        price_kes: z.number().int().min(0),
        duration_days: z.number().int().min(1).max(365),
        reward_per_post_kes: z.number().int().min(0),
        max_posts_per_day: z.number().int().min(1).max(10),
        max_rewarded_posts: z.number().int().min(1),
        is_active: z.boolean(),
        sort_order: z.number().int().default(0),
        features: z.array(z.string().max(120)).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    const { id, ...rest } = data;
    const q = id ? sa.from("packages").update(rest).eq("id", id) : sa.from("packages").insert(rest);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await sa.rpc("log_audit", {
      p_actor: context.userId,
      p_actor_type: "admin",
      p_action: id ? "package.updated" : "package.created",
      p_entity_type: "package",
      p_entity_id: id ?? data.slug,
      p_meta: { slug: data.slug, price_kes: data.price_kes },
    });
    return { ok: true };
  });

export const listAuditAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await admin();
    const { data } = await sa.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    return data ?? [];
  });
