import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/auth.middleware";
import { serverDb } from "@/lib/db.server";
import { assertAdmin } from "@/lib/admin.server";
import { nairobiWeekStartISO } from "@/lib/week";

 

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
    await sa.rpc("app_expire_activations");
    const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
    const weekStart = nairobiWeekStartISO();
    const [
      users,
      pending,
      flagged,
      withdrawals,
      activeActivations,
      paidOrders,
      rewards,
      audit,
      weekApproved,
      weekRewards,
      weekPayouts,
      wallets,
      weekOrders,
      activeOwners,
      weekSubmitters,
      weekEarners,
    ] = await Promise.all([
      count(sa.from("profiles").select("user_id", { count: "exact", head: true })),
      count(sa.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending")),
      count(sa.from("submissions").select("id", { count: "exact", head: true }).eq("status", "flagged")),
      count(sa.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "requested")),
      count(sa.from("activations").select("id", { count: "exact", head: true }).eq("status", "active")),
      sa.from("orders").select("amount_kes").eq("status", "paid"),
      sa.from("wallet_transactions").select("amount_kes").in("type", ["reward", "referral_bonus"]),
      sa.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(12),
      count(
        sa
          .from("submissions")
          .select("id", { count: "exact", head: true })
          .eq("status", "approved")
          .gte("reviewed_at", weekStart),
      ),
      sa
        .from("wallet_transactions")
        .select("amount_kes")
        .in("type", ["reward", "referral_bonus"])
        .gte("created_at", weekStart),
      sa.from("withdrawals").select("amount_kes").eq("status", "paid").gte("processed_at", weekStart),
      sa.from("wallets").select("balance_kes,pending_kes"),
      sa.from("orders").select("amount_kes").eq("status", "paid").gte("paid_at", weekStart),
      sa.from("activations").select("user_id").eq("status", "active"),
      sa.from("submissions").select("user_id").gte("created_at", weekStart),
      sa
        .from("wallet_transactions")
        .select("user_id")
        .in("type", ["reward", "referral_bonus"])
        .gte("created_at", weekStart),
    ]);
    const walletRows = wallets.data ?? [];
    const activeOwnerIds = new Set((activeOwners.data ?? []).map((r) => r.user_id));
    const submitterIds = new Set((weekSubmitters.data ?? []).map((r) => r.user_id));
    const earnerIds = new Set((weekEarners.data ?? []).map((r) => r.user_id));
    let idleWithActivePackage = 0;
    for (const id of activeOwnerIds) if (!submitterIds.has(id)) idleWithActivePackage += 1;
    return {
      users,
      pendingSubmissions: pending,
      flaggedSubmissions: flagged,
      pendingWithdrawals: withdrawals,
      activeActivations,
      packageRevenueKes: (paidOrders.data ?? []).reduce((s, o) => s + o.amount_kes, 0),
      rewardsCreditedKes: (rewards.data ?? []).reduce((s, t) => s + t.amount_kes, 0),
      recentAudit: audit.data ?? [],
      walletBalancesKes: walletRows.reduce((s, w) => s + w.balance_kes, 0),
      walletPendingKes: walletRows.reduce((s, w) => s + w.pending_kes, 0),
      week: {
        startsAt: weekStart,
        activeCampaigns: activeActivations,
        approvedSubmissions: weekApproved,
        rewardsKes: (weekRewards.data ?? []).reduce((s, t) => s + t.amount_kes, 0),
        payoutsKes: (weekPayouts.data ?? []).reduce((s, w) => s + w.amount_kes, 0),
        packageFeesKes: (weekOrders.data ?? []).reduce((s, o) => s + o.amount_kes, 0),
      },
      engagement: {
        membersWithOpenCampaign: activeOwnerIds.size,
        membersWhoSubmitted: submitterIds.size,
        membersWhoEarned: earnerIds.size,
        idleWithActivePackage,
      },
    };
  });

export const listSubmissionsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["pending", "flagged", "approved", "rejected", "all"]).default("pending") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
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
    const sa = await serverDb(context.supabase);
    const { data: row, error } = await sa.rpc("app_review_submission", {
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
    const sa = await serverDb(context.supabase);
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
    const sa = await serverDb(context.supabase);
    const { data: row, error } = await sa.rpc("app_process_withdrawal", {
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
    const sa = await serverDb(context.supabase);
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
    const sa = await serverDb(context.supabase);
    if (data.makeAdmin) {
      await sa.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await sa.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }
    await sa.rpc("app_log_audit", {
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
    const sa = await serverDb(context.supabase);
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
    const sa = await serverDb(context.supabase);
    const [{ data: settings }, { data: packages }] = await Promise.all([
      sa.from("app_settings").select("*").order("key"),
      sa.from("packages").select("*").order("sort_order"),
    ]);
    const { getPaymentMode, isLivePayments } = await import("@/lib/payments/mpesa.server");
    const pub = process.env["INTASEND_PUBLISHABLE_KEY"] ?? "";
    const env = process.env["INTASEND_ENV"] ?? (pub.includes("_live_") ? "live" : "test");
    const webhookUrl = `https://project--aeca5134-ae22-4469-a255-a0e34708cd88.lovable.app/api/public/intasend/webhook`;
    return {
      settings: settings ?? [],
      packages: packages ?? [],
      paymentMode: getPaymentMode(),
      intasend: {
        configured: Boolean(pub && process.env["INTASEND_SECRET_KEY"]),
        live: isLivePayments(),
        env,
        hasChallenge: Boolean(process.env["INTASEND_WEBHOOK_CHALLENGE"]),
        webhookUrl,
      },
    };
  });

export const updateSettingAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().min(1).max(60), value: z.unknown() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
    const { error } = await sa.from("app_settings").update({ value: data.value as never }).eq("key", data.key);
    if (error) throw new Error(error.message);
    await sa.rpc("app_log_audit", {
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
    const sa = await serverDb(context.supabase);
    const { id, ...rest } = data;
    const q = id ? sa.from("packages").update(rest).eq("id", id) : sa.from("packages").insert(rest);
    const { error } = await q;
    if (error) throw new Error(error.message);
    await sa.rpc("app_log_audit", {
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
    const sa = await serverDb(context.supabase);
    const { data } = await sa.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
    return data ?? [];
  });

/** Approved rewards + wallet balances + payout history for the admin payouts page. */
export const getPayoutsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
    const [{ data: approved }, { data: txs }, { data: withdrawals }, { data: settings }] = await Promise.all([
      sa
        .from("submissions")
        .select("id, user_id, reward_kes, reviewed_at, campaign:campaigns(title)")
        .eq("status", "approved")
        .order("reviewed_at", { ascending: true })
        .limit(1000),
      sa.from("wallet_transactions").select("ref_id").eq("ref_type", "submission").limit(5000),
      sa.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(500),
      sa.from("app_settings").select("key, value").in("key", ["min_withdrawal_kes"]),
    ]);
    const credited = new Set((txs ?? []).map((t) => t.ref_id));
    const unreleased = (approved ?? []).filter((s) => !credited.has(s.id) && (s.reward_kes ?? 0) > 0);

    const ids = [...new Set([...unreleased.map((s) => s.user_id), ...(withdrawals ?? []).map((w) => w.user_id)])];
    const [{ data: profiles }, { data: wallets }] = await Promise.all([
      ids.length ? sa.from("profiles").select("user_id, full_name, email, phone").in("user_id", ids) : Promise.resolve({ data: [] }),
      ids.length ? sa.from("wallets").select("*").in("user_id", ids) : Promise.resolve({ data: [] }),
    ]);
    const p = new Map((profiles ?? []).map((x) => [x.user_id, x]));
    const w = new Map((wallets ?? []).map((x) => [x.user_id, x]));

    const grouped = new Map<string, { userId: string; submissionIds: string[]; amountKes: number }>();
    for (const s of unreleased) {
      const g = grouped.get(s.user_id) ?? { userId: s.user_id, submissionIds: [], amountKes: 0 };
      g.submissionIds.push(s.id);
      g.amountKes += s.reward_kes ?? 0;
      grouped.set(s.user_id, g);
    }

    const minWithdrawal = Number((settings ?? []).find((s) => s.key === "min_withdrawal_kes")?.value ?? 0);

    return {
      minWithdrawalKes: Number.isFinite(minWithdrawal) ? minWithdrawal : 0,
      pendingRelease: [...grouped.values()].map((g) => ({
        ...g,
        user: p.get(g.userId) ?? null,
        wallet: w.get(g.userId) ?? null,
      })),
      payable: (wallets ?? [])
        .filter((x) => x.balance_kes > 0)
        .map((x) => ({ userId: x.user_id, wallet: x, user: p.get(x.user_id) ?? null }))
        .sort((a, b) => b.wallet.balance_kes - a.wallet.balance_kes),
      payouts: (withdrawals ?? []).map((x) => ({ ...x, user: p.get(x.user_id) ?? null })),
    };
  });

/** Credit approved-but-uncredited submission rewards into a member's wallet. */
export const releaseRewardsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
    const [{ data: approved }, { data: txs }] = await Promise.all([
      sa.from("submissions").select("id, reward_kes").eq("status", "approved").eq("user_id", data.userId).limit(1000),
      sa.from("wallet_transactions").select("ref_id").eq("ref_type", "submission").eq("user_id", data.userId).limit(5000),
    ]);
    const credited = new Set((txs ?? []).map((t) => t.ref_id));
    const todo = (approved ?? []).filter((s) => !credited.has(s.id) && (s.reward_kes ?? 0) > 0);
    if (!todo.length) return { released: 0, amountKes: 0 };

    const { data: wallet } = await sa.from("wallets").select("*").eq("user_id", data.userId).single();
    if (!wallet) throw new Error("Member wallet not found.");
    let balance = wallet.balance_kes;
    let amountKes = 0;
    for (const s of todo) {
      const amount = s.reward_kes ?? 0;
      balance += amount;
      amountKes += amount;
      const { error } = await sa.from("wallet_transactions").insert({
        user_id: data.userId,
        type: "reward",
        amount_kes: amount,
        balance_after_kes: balance,
        ref_type: "submission",
        ref_id: s.id,
        description: "Approved reward released to wallet",
      });
      if (error) throw new Error(error.message);
    }
    const { error: wErr } = await sa
      .from("wallets")
      .update({ balance_kes: balance, lifetime_earned_kes: wallet.lifetime_earned_kes + amountKes })
      .eq("user_id", data.userId);
    if (wErr) throw new Error(wErr.message);

    await sa.from("notifications").insert({
      user_id: data.userId,
      kind: "wallet",
      title: "Rewards released to your wallet",
      body: `KES ${amountKes.toLocaleString("en-KE")} from approved posts is now available in your wallet.`,
      link: "/wallet",
    });
    await sa.rpc("app_log_audit", {
      p_actor: context.userId,
      p_actor_type: "admin",
      p_action: "rewards.released",
      p_entity_type: "user",
      p_entity_id: data.userId,
      p_meta: { amount_kes: amountKes, submissions: todo.length } as never,
    });
    return { released: todo.length, amountKes };
  });

/** Send a real-money payout from a member's wallet balance and record the M-Pesa receipt. */
export const payMemberAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        amountKes: z.number().int().min(1),
        phone: z.string().min(9).max(15),
        receipt: z.string().max(40).optional(),
        note: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
    const { data: wallet } = await sa.from("wallets").select("balance_kes").eq("user_id", data.userId).single();
    if (!wallet || wallet.balance_kes < data.amountKes) throw new Error("Member balance is lower than the payout amount.");

    const { data: wd, error } = await sa.rpc("app_request_withdrawal", {
      p_user_id: data.userId,
      p_amount: data.amountKes,
      p_phone: data.phone,
    });
    if (error) throw new Error(error.message);
    const withdrawalId = (wd as { id: string } | null)?.id;
    if (!withdrawalId) throw new Error("Could not create the payout record.");

    const { data: paid, error: payErr } = await sa.rpc("app_process_withdrawal", {
      p_admin: context.userId,
      p_withdrawal_id: withdrawalId,
      p_decision: "paid",
      p_note: data.note ?? "Payout sent by admin",
      p_receipt: data.receipt ?? "",
    });
    if (payErr) throw new Error(payErr.message);
    return paid;
  });

/* ---------------- Campaign content management ---------------- */

const ASSET_BUCKET = "campaign-assets";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

const uploadSchema = z.object({
  base64: z.string().min(10),
  mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
  filename: z.string().max(120).optional(),
});

/** Uploads a campaign asset into private storage and returns a long-lived signed URL. */
async function storeAsset(
  sa: Awaited<ReturnType<typeof serverDb>>,
  file: z.infer<typeof uploadSchema>,
  folder: string,
) {
  const bytes = Buffer.from(file.base64, "base64");
  if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Please use an image smaller than 8MB.");
  const ext = file.mime === "image/png" ? "png" : file.mime === "image/webp" ? "webp" : "jpg";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const up = await sa.storage.from(ASSET_BUCKET).upload(path, bytes, { contentType: file.mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const signed = await sa.storage.from(ASSET_BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Could not prepare the image link.");
  return signed.data.signedUrl;
}

/** Advertisers, campaigns and their materials for the admin content manager. */
export const listCampaignContentAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
    const [{ data: advertisers }, { data: campaigns }, { data: activeCounts }] = await Promise.all([
      sa.from("advertisers").select("*").order("created_at"),
      sa
        .from("campaigns")
        .select("*, advertiser:advertisers(id, name), materials:campaign_materials(*)")
        .order("created_at", { ascending: false }),
      sa.from("activations").select("campaign_id").eq("status", "active"),
    ]);
    const used = new Map<string, number>();
    for (const a of activeCounts ?? []) used.set(a.campaign_id, (used.get(a.campaign_id) ?? 0) + 1);
    return {
      advertisers: advertisers ?? [],
      campaigns: (campaigns ?? []).map((c) => ({
        ...c,
        materials: [...(c.materials ?? [])].sort((a, b) => a.sort_order - b.sort_order),
        activeMembers: used.get(c.id) ?? 0,
      })),
    };
  });

export const upsertAdvertiserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(60),
        website_url: z.string().url().max(300),
        tagline: z.string().max(160).default(""),
        is_active: z.boolean().default(true),
        logo: uploadSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
    const { id, logo, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (logo) patch["logo_url"] = await storeAsset(sa, logo, "advertisers");
    const { data: row, error } = id
      ? await sa.from("advertisers").update(patch as never).eq("id", id).select("*").single()
      : await sa.from("advertisers").insert(patch as never).select("*").single();
    if (error) throw new Error(error.message);
    await sa.rpc("app_log_audit", {
      p_actor: context.userId,
      p_actor_type: "admin",
      p_action: id ? "advertiser.updated" : "advertiser.created",
      p_entity_type: "advertiser",
      p_entity_id: row.id,
      p_meta: { name: data.name } as never,
    });
    return row;
  });

export const upsertCampaignAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        advertiser_id: z.string().uuid(),
        title: z.string().min(3).max(90),
        brief: z.string().max(1200).default(""),
        cta_url: z.string().url().max(300),
        is_active: z.boolean().default(true),
        cover: uploadSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
    const { id, cover, ...rest } = data;
    const patch: Record<string, unknown> = { ...rest };
    if (cover) patch["cover_url"] = await storeAsset(sa, cover, "campaigns");
    const { data: row, error } = id
      ? await sa.from("campaigns").update(patch as never).eq("id", id).select("*").single()
      : await sa.from("campaigns").insert(patch as never).select("*").single();
    if (error) throw new Error(error.message);
    await sa.rpc("app_log_audit", {
      p_actor: context.userId,
      p_actor_type: "admin",
      p_action: id ? "campaign.updated" : "campaign.created",
      p_entity_type: "campaign",
      p_entity_id: row.id,
      p_meta: { title: data.title, is_active: data.is_active } as never,
    });
    return row;
  });

/** Adds or updates one campaign material: an image to post, or a ready-made caption. */
export const saveMaterialAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        campaign_id: z.string().uuid(),
        kind: z.enum(["image", "caption"]),
        title: z.string().min(2).max(90),
        caption_text: z.string().max(600).optional(),
        sort_order: z.number().int().min(0).max(99).default(0),
        file: uploadSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.kind === "image" && !data.file && !data.id) throw new Error("Please choose an image to upload.");
    if (data.kind === "caption" && !data.caption_text?.trim()) throw new Error("Please write the caption text.");
    const sa = await serverDb(context.supabase);
    const patch: Record<string, unknown> = {
      campaign_id: data.campaign_id,
      kind: data.kind,
      title: data.title,
      sort_order: data.sort_order,
      caption_text: data.kind === "caption" ? data.caption_text : (data.caption_text ?? null),
    };
    if (data.file) patch["asset_url"] = await storeAsset(sa, data.file, `campaigns/${data.campaign_id}`);
    const { data: row, error } = data.id
      ? await sa.from("campaign_materials").update(patch as never).eq("id", data.id).select("*").single()
      : await sa.from("campaign_materials").insert(patch as never).select("*").single();
    if (error) throw new Error(error.message);
    await sa.rpc("app_log_audit", {
      p_actor: context.userId,
      p_actor_type: "admin",
      p_action: data.id ? "material.updated" : "material.created",
      p_entity_type: "campaign_material",
      p_entity_id: row.id,
      p_meta: { campaign_id: data.campaign_id, kind: data.kind } as never,
    });
    return row;
  });

export const deleteMaterialAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);
    const { error } = await sa.from("campaign_materials").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await sa.rpc("app_log_audit", {
      p_actor: context.userId,
      p_actor_type: "admin",
      p_action: "material.deleted",
      p_entity_type: "campaign_material",
      p_entity_id: data.id,
      p_meta: {} as never,
    });
    return { ok: true };
  });

/**
 * Manual fallback for orders the IntaSend webhook never resolved.
 * Uses the same database routines as the webhook, so it stays idempotent:
 * an order already paid or already failed is left untouched.
 */
export const resolveOrderAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approve", "cancel"]),
        receipt: z.string().trim().max(40).optional(),
        note: z.string().trim().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const sa = await serverDb(context.supabase);

    const { data: order, error: readErr } = await sa
      .from("orders")
      .select("id, status, provider_ref")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!order) throw new Error("ORDER_NOT_FOUND");
    if (order.status !== "pending") throw new Error("ORDER_ALREADY_RESOLVED");

    if (data.decision === "approve") {
      const { error } = await sa.rpc("app_confirm_order_paid", {
        p_order_id: data.id,
        p_provider_ref: order.provider_ref ?? "manual-admin",
        p_receipt: data.receipt && data.receipt.length > 0 ? data.receipt : "MANUAL-ADMIN",
        p_payload: { source: "admin_manual", admin_id: context.userId, note: data.note ?? "" } as never,
      });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await sa.rpc("app_fail_order", {
        p_order_id: data.id,
        p_reason: data.note && data.note.length > 0 ? data.note : "Cancelled by admin",
        p_payload: { source: "admin_manual", admin_id: context.userId } as never,
      });
      if (error) throw new Error(error.message);
    }

    await sa.rpc("app_log_audit", {
      p_actor: context.userId,
      p_actor_type: "admin",
      p_action: data.decision === "approve" ? "order.manually_approved" : "order.manually_cancelled",
      p_entity_type: "order",
      p_entity_id: data.id,
      p_meta: { receipt: data.receipt ?? null, note: data.note ?? null } as never,
    });

    return { ok: true };
  });

