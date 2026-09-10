import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeKenyanPhone } from "@/lib/format";
import { nairobiWeekStartISO } from "@/lib/week";

const SCREENSHOT_BUCKET = "screenshots";
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Session summary used by the dashboard shell. */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, roles, wallet, unread] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null),
    ]);
    return {
      userId,
      email: (context.claims as { email?: string }).email ?? profile.data?.email ?? null,
      profile: profile.data,
      isAdmin: (roles.data ?? []).some((r) => r.role === "admin"),
      wallet: wallet.data,
      unreadNotifications: unread.count ?? 0,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ full_name: z.string().trim().min(2).max(80), phone: z.string().trim() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const phone = normalizeKenyanPhone(data.phone);
    if (!phone) throw new Error("INVALID_PHONE");
    const { error } = await context.supabase
      .from("profiles")
      .update({ full_name: data.full_name, phone })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, phone };
  });

/** Dashboard home: activations, recent submissions, wallet, orders. */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const sa = await admin();
    await sa.rpc("expire_activations"); // server-timed expiry sweep
    const weekStart = nairobiWeekStartISO();
    const [activations, submissions, wallet, orders, notifications, weekApproved, weekTx] = await Promise.all([
      supabase
        .from("activations")
        .select("*, package:packages(*), campaign:campaigns(*, advertiser:advertisers(*))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("submissions")
        .select("id,status,reward_kes,created_at,reviewed_at,review_note,fraud_flags")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabase
        .from("orders")
        .select("*, package:packages(name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "approved")
        .gte("reviewed_at", weekStart),
      supabase
        .from("wallet_transactions")
        .select("type,amount_kes")
        .eq("user_id", userId)
        .gte("created_at", weekStart),
    ]);
    const tx = weekTx.data ?? [];
    const sum = (types: string[]) =>
      tx.filter((t) => types.includes(t.type)).reduce((s, t) => s + Math.abs(t.amount_kes), 0);
    const all = activations.data ?? [];
    return {
      activations: all,
      submissions: submissions.data ?? [],
      wallet: wallet.data,
      orders: orders.data ?? [],
      notifications: notifications.data ?? [],
      serverNow: new Date().toISOString(),
      week: {
        startsAt: weekStart,
        activeCampaigns: all.filter((a) => a.status === "active").length,
        approvedSubmissions: weekApproved.count ?? 0,
        rewardsKes: sum(["reward", "referral_bonus"]),
        paidOutKes: sum(["withdrawal_paid"]),
      },
    };
  });

/* ---------------- Purchases & payments ---------------- */

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ packageId: z.string().uuid(), campaignId: z.string().uuid(), phone: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const phone = normalizeKenyanPhone(data.phone);
    if (!phone) throw new Error("INVALID_PHONE");
    const { supabase, userId } = context;
    const sa = await admin();

    const [{ data: pkg }, { data: campaign }] = await Promise.all([
      supabase.from("packages").select("*").eq("id", data.packageId).eq("is_active", true).maybeSingle(),
      supabase.from("campaigns").select("id,is_active").eq("id", data.campaignId).maybeSingle(),
    ]);
    if (!pkg || !campaign?.is_active) throw new Error("NOT_FOUND");

    await sa.rpc("expire_activations");
    const { count } = await supabase
      .from("activations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("campaign_id", data.campaignId)
      .eq("status", "active");
    if ((count ?? 0) > 0) throw new Error("ACTIVE_ACTIVATION_EXISTS");

    // Keep the profile phone in sync so payouts default to the paying number.
    await supabase.from("profiles").update({ phone }).eq("user_id", userId).is("phone", null);

    const { getMpesaAdapter } = await import("@/lib/payments/mpesa.server");
    const adapter = getMpesaAdapter();

    const { data: order, error } = await sa
      .from("orders")
      .insert({
        user_id: userId,
        package_id: pkg.id,
        campaign_id: data.campaignId,
        amount_kes: pkg.price_kes,
        phone,
        provider:
          adapter.mode === "intasend" ? "mpesa_intasend" : adapter.mode === "daraja" ? "mpesa_daraja" : "mpesa_mock",
      })
      .select("*")
      .single();
    if (error || !order) throw new Error(error?.message ?? "Could not create order");

    try {
      const stk = await adapter.stkPush({
        phone,
        amountKes: pkg.price_kes,
        orderId: order.id,
        accountReference: `SR-${order.id.slice(0, 8).toUpperCase()}`,
        description: `${pkg.name} package`,
      });
      await sa.from("orders").update({ provider_ref: stk.checkoutRequestId }).eq("id", order.id);
      await sa.from("payment_events").insert({
        order_id: order.id,
        provider: order.provider,
        event_type: "stk_initiated",
        payload: { mode: adapter.mode, checkoutRequestId: stk.checkoutRequestId, phone },
      });
      await sa.rpc("log_audit", {
        p_actor: userId,
        p_actor_type: "user",
        p_action: "order.created",
        p_entity_type: "order",
        p_entity_id: order.id,
        p_meta: { amount_kes: pkg.price_kes, mode: adapter.mode },
      });
      return { orderId: order.id, mode: adapter.mode, customerMessage: stk.customerMessage };
    } catch (e) {
      await sa.rpc("fail_order", {
        p_order_id: order.id,
        p_reason: "Payment request could not be started.",
        p_payload: { error: e instanceof Error ? e.message : String(e) },
      });
      throw new Error("Payment request could not be started. Please try again.");
    }
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sel = "*, package:packages(*), campaign:campaigns(title, advertiser:advertisers(name))";
    let { data: order } = await context.supabase.from("orders").select(sel).eq("id", data.orderId).maybeSingle();
    if (!order) throw new Error("NOT_FOUND");

    // Live rail: IntaSend webhooks can be delayed or blocked, so the status page
    // also asks IntaSend directly while the order is still pending.
    if (order.status === "pending" && order.provider === "mpesa_intasend" && order.provider_ref) {
      const { settleIntasendOrder } = await import("@/lib/payments/intasend-settle.server");
      const outcome = await settleIntasendOrder(order.id, order.provider_ref, order.amount_kes);
      if (outcome !== "pending") {
        const refreshed = await context.supabase.from("orders").select(sel).eq("id", order.id).maybeSingle();
        if (refreshed.data) order = refreshed.data;
      }
    }

    const { data: activation } = await context.supabase
      .from("activations")
      .select("id, expires_at")
      .eq("order_id", order.id)
      .maybeSingle();
    const paymentMode =
      order.provider === "mpesa_mock" ? "mock" : order.provider === "mpesa_intasend" ? "intasend" : "daraja";
    return { order, activation, paymentMode };
  });

/** SANDBOX ONLY: resolves a pending mock order as paid or failed. */
export const simulatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ orderId: z.string().uuid(), outcome: z.enum(["success", "failure"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { getPaymentMode } = await import("@/lib/payments/mpesa.server");
    if (getPaymentMode() !== "mock") throw new Error("MOCK_ONLY");
    const { data: order } = await context.supabase
      .from("orders")
      .select("id,status,provider,provider_ref")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!order) throw new Error("NOT_FOUND");
    if (order.provider !== "mpesa_mock") throw new Error("MOCK_ONLY");
    if (order.status !== "pending") throw new Error("ORDER_NOT_PENDING");
    const sa = await admin();
    if (data.outcome === "success") {
      const receipt = `SBX${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const { data: activationId, error } = await sa.rpc("confirm_order_paid", {
        p_order_id: order.id,
        p_provider_ref: order.provider_ref ?? "",
        p_receipt: receipt,
        p_payload: { simulated: true, ResultCode: 0 },
      });
      if (error) throw new Error(error.message);
      return { status: "paid" as const, activationId };
    }
    const { error } = await sa.rpc("fail_order", {
      p_order_id: order.id,
      p_reason: "Simulated: request cancelled by user (sandbox).",
      p_payload: { simulated: true, ResultCode: 1032 },
    });
    if (error) throw new Error(error.message);
    return { status: "failed" as const, activationId: null };
  });

export const getMyOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("orders")
      .select("*, package:packages(name,duration_days)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

/* ---------------- Campaigns & submissions ---------------- */

export const getMyActivations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sa = await admin();
    await sa.rpc("expire_activations");
    const { data } = await context.supabase
      .from("activations")
      .select(
        "*, package:packages(*), campaign:campaigns(*, advertiser:advertisers(*), materials:campaign_materials(*))",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
    const { data: todays } = await context.supabase
      .from("submissions")
      .select("activation_id,status")
      .eq("user_id", context.userId)
      .eq("submitted_on", today)
      .neq("status", "rejected");
    const submittedToday = new Set((todays ?? []).map((s) => s.activation_id));
    return {
      activations: (data ?? []).map((a) => ({ ...a, submittedToday: submittedToday.has(a.id) })),
      serverNow: new Date().toISOString(),
    };
  });

export const submitScreenshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        activationId: z.string().uuid(),
        mime: z.string(),
        base64: z.string().min(10),
        note: z.string().max(300).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ext = ALLOWED_MIME[data.mime];
    if (!ext) throw new Error("INVALID_FILE");
    const bytes = Buffer.from(data.base64, "base64");
    const sa = await admin();
    const { data: setting } = await sa.from("app_settings").select("value").eq("key", "max_screenshot_mb").maybeSingle();
    const maxBytes = Number(setting?.value ?? 4) * 1024 * 1024;
    if (bytes.byteLength < 1024 || bytes.byteLength > maxBytes) throw new Error("INVALID_FILE");

    const { createHash } = await import("node:crypto");
    const sha = createHash("sha256").update(bytes).digest("hex");
    const path = `${context.userId}/${data.activationId}/${sha.slice(0, 16)}-${Date.now()}.${ext}`;

    const up = await sa.storage.from(SCREENSHOT_BUCKET).upload(path, bytes, { contentType: data.mime, upsert: false });
    if (up.error) throw new Error(up.error.message);

    const { data: submission, error } = await sa.rpc("create_submission", {
      p_user_id: context.userId,
      p_activation_id: data.activationId,
      p_storage_path: path,
      p_sha256: sha,
      p_size: bytes.byteLength,
      p_mime: data.mime,
      p_note: data.note ?? "",
    });
    if (error) {
      await sa.storage.from(SCREENSHOT_BUCKET).remove([path]);
      throw new Error(error.message);
    }
    return submission;
  });

export const getMySubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("submissions")
      .select("*, activation:activations(package:packages(name)), campaign:campaigns(title)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    const rows = data ?? [];
    const sa = await admin();
    const signed = rows.length
      ? await sa.storage.from(SCREENSHOT_BUCKET).createSignedUrls(rows.map((r) => r.storage_path), 600)
      : { data: [] };
    const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
    return rows.map((r) => ({ ...r, previewUrl: urlByPath.get(r.storage_path) ?? null }));
  });

/* ---------------- Wallet & withdrawals ---------------- */

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [wallet, tx, withdrawals, min, profile] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("wallet_transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("withdrawals").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("app_settings").select("value").eq("key", "min_withdrawal_kes").maybeSingle(),
      supabase.from("profiles").select("phone").eq("user_id", userId).maybeSingle(),
    ]);
    return {
      wallet: wallet.data,
      transactions: tx.data ?? [],
      withdrawals: withdrawals.data ?? [],
      minWithdrawalKes: Number(min.data?.value ?? 0),
      phone: profile.data?.phone ?? null,
    };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ amount: z.number().int().positive(), phone: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const phone = normalizeKenyanPhone(data.phone);
    if (!phone) throw new Error("INVALID_PHONE");
    const sa = await admin();
    const { data: wd, error } = await sa.rpc("request_withdrawal", {
      p_user_id: context.userId,
      p_amount: data.amount,
      p_phone: phone,
    });
    if (error) throw new Error(error.message);
    return wd;
  });

/* ---------------- Notifications & referrals ---------------- */

export const getNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    return { ok: true };
  });

export const getReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, referrals, settings] = await Promise.all([
      supabase.from("profiles").select("referral_code").eq("user_id", userId).maybeSingle(),
      supabase.from("referrals").select("*").eq("referrer_id", userId).order("created_at", { ascending: false }),
      supabase.from("app_settings").select("key,value").in("key", ["referral_enabled", "referral_bonus_kes"]),
    ]);
    const sa = await admin();
    const ids = (referrals.data ?? []).map((r) => r.referred_id);
    const { data: names } = ids.length ? await sa.from("profiles").select("user_id,full_name").in("user_id", ids) : { data: [] };
    const nameById = new Map((names ?? []).map((n) => [n.user_id, n.full_name]));
    const s: Record<string, unknown> = {};
    for (const row of settings.data ?? []) s[row.key] = row.value;
    return {
      code: profile.data?.referral_code ?? null,
      enabled: Boolean(s["referral_enabled"]),
      bonusKes: Number(s["referral_bonus_kes"] ?? 0),
      referrals: (referrals.data ?? []).map((r) => {
        const full = nameById.get(r.referred_id) ?? "Member";
        const masked = full.trim() ? `${full.trim().split(" ")[0]} ${full.trim().split(" ")[1]?.[0] ?? ""}.`.trim() : "Member";
        return { ...r, referredName: masked };
      }),
    };
  });
