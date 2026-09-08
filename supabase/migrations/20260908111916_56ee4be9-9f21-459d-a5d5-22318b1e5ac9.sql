-- ===== ENUMS =====
create type public.app_role as enum ('admin','user');
create type public.order_status as enum ('pending','paid','failed','cancelled');
create type public.activation_status as enum ('active','expired','revoked');
create type public.submission_status as enum ('pending','approved','rejected','flagged');
create type public.withdrawal_status as enum ('requested','paid','rejected');
create type public.wallet_tx_type as enum ('reward','referral_bonus','withdrawal_hold','withdrawal_paid','withdrawal_reversed','adjustment');
create type public.notification_kind as enum ('payment','activation','submission','wallet','withdrawal','referral','system');

-- ===== HELPERS =====
create or replace function public.update_updated_at_column() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.generate_referral_code() returns text
language plpgsql set search_path = public as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; code text; i int;
begin
  loop
    code := 'SR-';
    for i in 1..6 loop code := code || substr(chars, 1 + floor(random()*length(chars))::int, 1); end loop;
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end; $$;

-- ===== PROFILES & ROLES =====
create table public.profiles (
  user_id uuid primary key,
  email text,
  full_name text not null default '',
  phone text,
  avatar_url text,
  referral_code text unique,
  referred_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "profiles: own or admin read" on public.profiles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "profiles: own update" on public.profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "roles: own or admin read" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

-- ===== SETTINGS =====
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);
grant select on public.app_settings to anon, authenticated;
grant all on public.app_settings to service_role;
alter table public.app_settings enable row level security;
create policy "settings: public read" on public.app_settings for select to anon, authenticated
  using (is_public or public.has_role(auth.uid(),'admin'));
create trigger app_settings_updated_at before update on public.app_settings for each row execute function public.update_updated_at_column();

insert into public.app_settings (key, value, is_public, description) values
 ('referral_enabled', 'true', true, 'Whether referral bonuses are paid'),
 ('referral_bonus_kes', '50', true, 'KES credited to the referrer when the referred person completes their first package purchase'),
 ('min_withdrawal_kes', '200', true, 'Minimum wallet withdrawal in KES'),
 ('max_screenshot_mb', '4', true, 'Maximum screenshot upload size in MB'),
 ('bootstrap_admin_email', '"admin@statusreach.co.ke"', false, 'First sign-up with this email becomes admin while no admin exists'),
 ('support_phone', '"+254 700 000 000"', true, 'Public support phone (placeholder)'),
 ('support_email', '"support@statusreach.co.ke"', true, 'Public support email (placeholder)');

-- ===== PACKAGES =====
create table public.packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text not null default '',
  price_kes integer not null check (price_kes >= 0),
  duration_days integer not null check (duration_days > 0),
  reward_per_post_kes integer not null check (reward_per_post_kes >= 0),
  max_posts_per_day integer not null default 1,
  max_rewarded_posts integer not null,
  features jsonb not null default '[]',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.packages to anon, authenticated;
grant all on public.packages to service_role;
alter table public.packages enable row level security;
create policy "packages: public read active" on public.packages for select to anon, authenticated
  using (is_active or public.has_role(auth.uid(),'admin'));
create trigger packages_updated_at before update on public.packages for each row execute function public.update_updated_at_column();

insert into public.packages (slug,name,tagline,price_kes,duration_days,reward_per_post_kes,max_posts_per_day,max_rewarded_posts,features,sort_order) values
 ('bronze','Bronze','Start sharing verified campaigns','250',7,20,1,7,'["7-day campaign window","1 verified post per day","KES 20 per approved post","Up to KES 140 in verified-engagement rewards","Campaign materials pack"]',1),
 ('silver','Silver','More days, higher per-post reward','500',14,30,1,14,'["14-day campaign window","1 verified post per day","KES 30 per approved post","Up to KES 420 in verified-engagement rewards","Priority review queue"]',2),
 ('gold','Gold','Our longest campaign window','1000',30,45,1,30,'["30-day campaign window","1 verified post per day","KES 45 per approved post","Up to KES 1,350 in verified-engagement rewards","Priority review + support"]',3);

-- ===== ADVERTISERS / CAMPAIGNS =====
create table public.advertisers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  website_url text not null,
  tagline text not null default '',
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.advertisers to anon, authenticated;
grant all on public.advertisers to service_role;
alter table public.advertisers enable row level security;
create policy "advertisers: public read" on public.advertisers for select to anon, authenticated
  using (is_active or public.has_role(auth.uid(),'admin'));

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertisers(id) on delete cascade,
  title text not null,
  brief text not null default '',
  cta_url text not null,
  cover_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.campaigns to anon, authenticated;
grant all on public.campaigns to service_role;
alter table public.campaigns enable row level security;
create policy "campaigns: public read" on public.campaigns for select to anon, authenticated
  using (is_active or public.has_role(auth.uid(),'admin'));

create table public.campaign_materials (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  kind text not null check (kind in ('image','caption','video')),
  title text not null,
  asset_url text,
  caption_text text,
  sort_order integer not null default 0
);
grant select on public.campaign_materials to anon, authenticated;
grant all on public.campaign_materials to service_role;
alter table public.campaign_materials enable row level security;
create policy "materials: public read" on public.campaign_materials for select to anon, authenticated using (true);

insert into public.advertisers (id,name,website_url,tagline,logo_url) values
 ('a0000000-0000-0000-0000-000000000001','Shopit Kenya','https://www.shopit.co.ke','Online shopping in Kenya — electronics, home & more','/campaign/shopit-demo-logo.png');
insert into public.campaigns (id,advertiser_id,title,brief,cta_url,cover_url) values
 ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Shopit Kenya — Shop Smart Week',
  'Share the Shop Smart Week creatives on your WhatsApp status. Keep the caption and the shop link unchanged, post once per day during your campaign window, and upload a screenshot showing the status view count after at least 12 hours.',
  'https://www.shopit.co.ke','/campaign/shopit-status-1.jpg');
insert into public.campaign_materials (campaign_id,kind,title,asset_url,caption_text,sort_order) values
 ('c0000000-0000-0000-0000-000000000001','image','Status creative 1 — Electronics deals','/campaign/shopit-status-1.jpg',null,1),
 ('c0000000-0000-0000-0000-000000000001','image','Status creative 2 — Home & kitchen','/campaign/shopit-status-2.jpg',null,2),
 ('c0000000-0000-0000-0000-000000000001','caption','Caption A',null,'Shop Smart Week is on at Shopit Kenya 🛍️ Genuine electronics, home essentials & more delivered countrywide. Tap to shop: https://www.shopit.co.ke',3),
 ('c0000000-0000-0000-0000-000000000001','caption','Caption B',null,'Upgrade your home this week with Shopit Kenya — great prices, fast delivery, pay on delivery available. https://www.shopit.co.ke',4);

-- ===== ORDERS & PAYMENTS =====
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  package_id uuid not null references public.packages(id),
  campaign_id uuid not null references public.campaigns(id),
  amount_kes integer not null,
  phone text not null,
  status public.order_status not null default 'pending',
  provider text not null default 'mpesa_mock',
  provider_ref text,
  mpesa_receipt text,
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
grant select on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders: own or admin read" on public.orders for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create index orders_user_idx on public.orders(user_id, created_at desc);
create index orders_provider_ref_idx on public.orders(provider_ref);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  provider text not null,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
grant select on public.payment_events to authenticated;
grant all on public.payment_events to service_role;
alter table public.payment_events enable row level security;
create policy "payment_events: admin read" on public.payment_events for select to authenticated
  using (public.has_role(auth.uid(),'admin'));

-- ===== ACTIVATIONS =====
create table public.activations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  order_id uuid not null references public.orders(id),
  package_id uuid not null references public.packages(id),
  campaign_id uuid not null references public.campaigns(id),
  status public.activation_status not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_posts integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.activations to authenticated;
grant all on public.activations to service_role;
alter table public.activations enable row level security;
create policy "activations: own or admin read" on public.activations for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create index activations_user_idx on public.activations(user_id, status);

-- ===== SUBMISSIONS =====
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  activation_id uuid not null references public.activations(id),
  user_id uuid not null,
  campaign_id uuid not null references public.campaigns(id),
  storage_path text not null,
  file_sha256 text not null,
  file_size_bytes integer not null,
  mime_type text not null,
  note text,
  status public.submission_status not null default 'pending',
  fraud_flags jsonb not null default '[]',
  fraud_score integer not null default 0,
  reward_kes integer,
  reviewer_id uuid,
  review_note text,
  submitted_on date not null default (now() at time zone 'Africa/Nairobi')::date,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
grant select on public.submissions to authenticated;
grant all on public.submissions to service_role;
alter table public.submissions enable row level security;
create policy "submissions: own or admin read" on public.submissions for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create index submissions_status_idx on public.submissions(status, created_at);
create index submissions_hash_idx on public.submissions(file_sha256);
create index submissions_user_day_idx on public.submissions(activation_id, submitted_on);

-- ===== WALLET =====
create table public.wallets (
  user_id uuid primary key,
  balance_kes integer not null default 0 check (balance_kes >= 0),
  pending_kes integer not null default 0 check (pending_kes >= 0),
  lifetime_earned_kes integer not null default 0,
  lifetime_withdrawn_kes integer not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "wallets: own or admin read" on public.wallets for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create trigger wallets_updated_at before update on public.wallets for each row execute function public.update_updated_at_column();

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type public.wallet_tx_type not null,
  amount_kes integer not null,
  balance_after_kes integer not null,
  ref_type text,
  ref_id uuid,
  description text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.wallet_transactions to authenticated;
grant all on public.wallet_transactions to service_role;
alter table public.wallet_transactions enable row level security;
create policy "wallet_tx: own or admin read" on public.wallet_transactions for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create index wallet_tx_user_idx on public.wallet_transactions(user_id, created_at desc);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount_kes integer not null check (amount_kes > 0),
  phone text not null,
  status public.withdrawal_status not null default 'requested',
  admin_note text,
  mpesa_receipt text,
  processed_by uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
grant select on public.withdrawals to authenticated;
grant all on public.withdrawals to service_role;
alter table public.withdrawals enable row level security;
create policy "withdrawals: own or admin read" on public.withdrawals for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

-- ===== NOTIFICATIONS / REFERRALS / AUDIT =====
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind public.notification_kind not null default 'system',
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notifications: own read" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "notifications: own mark read" on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index notifications_user_idx on public.notifications(user_id, created_at desc);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null,
  referred_id uuid not null unique,
  bonus_kes integer,
  status text not null default 'pending' check (status in ('pending','rewarded','ineligible')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz
);
grant select on public.referrals to authenticated;
grant all on public.referrals to service_role;
alter table public.referrals enable row level security;
create policy "referrals: referrer or admin read" on public.referrals for select to authenticated
  using (auth.uid() = referrer_id or public.has_role(auth.uid(),'admin'));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_type text not null default 'user',
  action text not null,
  entity_type text,
  entity_id uuid,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit: admin read" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));
create index audit_created_idx on public.audit_logs(created_at desc);

-- ===== SIGN-UP TRIGGER =====
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ref_code text; v_referrer uuid; v_bootstrap text;
begin
  v_ref_code := upper(nullif(trim(coalesce(new.raw_user_meta_data->>'referral_code','')),''));
  if v_ref_code is not null then
    select user_id into v_referrer from public.profiles where referral_code = v_ref_code;
  end if;
  insert into public.profiles (user_id, email, full_name, phone, avatar_url, referral_code, referred_by)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
          nullif(new.raw_user_meta_data->>'phone',''),
          new.raw_user_meta_data->>'avatar_url',
          public.generate_referral_code(), v_referrer);
  insert into public.wallets (user_id) values (new.id);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if v_referrer is not null then
    insert into public.referrals (referrer_id, referred_id) values (v_referrer, new.id);
  end if;
  select value #>> '{}' into v_bootstrap from public.app_settings where key = 'bootstrap_admin_email';
  if v_bootstrap is not null and lower(new.email) = lower(v_bootstrap)
     and not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  insert into public.notifications (user_id, kind, title, body, link)
  values (new.id, 'system', 'Welcome to StatusReach Kenya', 'Pick a package to activate your first campaign. Rewards are paid only for verified, approved posts.', '/packages');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ===== DOMAIN FUNCTIONS (service-role only) =====
create or replace function public.log_audit(p_actor uuid, p_actor_type text, p_action text, p_entity_type text, p_entity_id uuid, p_meta jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, meta)
  values (p_actor, p_actor_type, p_action, p_entity_type, p_entity_id, coalesce(p_meta,'{}'));
$$;

create or replace function public.expire_activations() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with upd as (
    update public.activations set status = 'expired'
    where status = 'active' and expires_at <= now() returning id, user_id
  ), notif as (
    insert into public.notifications (user_id, kind, title, body, link)
    select user_id, 'activation', 'Campaign window ended', 'Your campaign window has expired. Pending screenshots are still reviewed; buy a new package to keep sharing.', '/packages' from upd
  )
  select count(*) into n from upd;
  return coalesce(n,0);
end; $$;

create or replace function public.confirm_order_paid(p_order_id uuid, p_provider_ref text, p_receipt text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype; pk public.packages%rowtype; v_activation uuid;
        v_ref public.referrals%rowtype; v_bonus integer; v_enabled boolean; v_bal integer;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found'; end if;
  if o.status = 'paid' then
    select id into v_activation from public.activations where order_id = o.id; return v_activation;
  end if;
  if o.status <> 'pending' then raise exception 'order is %', o.status; end if;
  select * into pk from public.packages where id = o.package_id;
  update public.orders set status='paid', paid_at=now(), provider_ref=coalesce(p_provider_ref, provider_ref), mpesa_receipt=p_receipt where id=o.id;
  insert into public.payment_events (order_id, provider, event_type, payload) values (o.id, o.provider, 'paid', coalesce(p_payload,'{}'));
  insert into public.activations (user_id, order_id, package_id, campaign_id, starts_at, expires_at)
  values (o.user_id, o.id, o.package_id, o.campaign_id, now(), now() + make_interval(days => pk.duration_days))
  returning id into v_activation;
  insert into public.notifications (user_id, kind, title, body, link)
  values (o.user_id, 'payment', 'Payment received — campaign activated',
          format('Your %s package is active for %s days. Download the materials and start sharing.', pk.name, pk.duration_days), '/dashboard/campaigns');
  perform public.log_audit(o.user_id, 'system', 'order.paid', 'order', o.id, jsonb_build_object('amount_kes', o.amount_kes, 'activation_id', v_activation));

  -- referral bonus on first paid order
  select * into v_ref from public.referrals where referred_id = o.user_id and status = 'pending' for update;
  if found then
    select (value)::boolean into v_enabled from public.app_settings where key='referral_enabled';
    select (value)::int into v_bonus from public.app_settings where key='referral_bonus_kes';
    if coalesce(v_enabled,false) and coalesce(v_bonus,0) > 0 then
      update public.wallets set balance_kes = balance_kes + v_bonus, lifetime_earned_kes = lifetime_earned_kes + v_bonus
        where user_id = v_ref.referrer_id returning balance_kes into v_bal;
      insert into public.wallet_transactions (user_id, type, amount_kes, balance_after_kes, ref_type, ref_id, description)
        values (v_ref.referrer_id, 'referral_bonus', v_bonus, v_bal, 'referral', v_ref.id, 'Referral bonus — referred member completed first purchase');
      update public.referrals set status='rewarded', bonus_kes=v_bonus, rewarded_at=now() where id=v_ref.id;
      insert into public.notifications (user_id, kind, title, body, link)
        values (v_ref.referrer_id, 'referral', 'Referral bonus credited', format('KES %s was added to your wallet for a successful referral.', v_bonus), '/dashboard/wallet');
    else
      update public.referrals set status='ineligible' where id=v_ref.id;
    end if;
  end if;
  return v_activation;
end; $$;

create or replace function public.fail_order(p_order_id uuid, p_reason text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status='failed', failure_reason=p_reason where id=p_order_id and status='pending';
  insert into public.payment_events (order_id, provider, event_type, payload)
    select id, provider, 'failed', coalesce(p_payload,'{}') from public.orders where id=p_order_id;
  insert into public.notifications (user_id, kind, title, body, link)
    select user_id, 'payment', 'Payment not completed', coalesce(p_reason,'The payment was not completed. You can try again from Packages.'), '/packages' from public.orders where id=p_order_id;
end; $$;

create or replace function public.create_submission(p_user_id uuid, p_activation_id uuid, p_storage_path text, p_sha256 text, p_size integer, p_mime text, p_note text)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare a public.activations%rowtype; pk public.packages%rowtype; flags jsonb := '[]'; score int := 0;
        v_today date := (now() at time zone 'Africa/Nairobi')::date; v_today_count int; v_dupes int; v_recent int; s public.submissions%rowtype;
begin
  perform public.expire_activations();
  select * into a from public.activations where id = p_activation_id and user_id = p_user_id for update;
  if not found then raise exception 'ACTIVATION_NOT_FOUND'; end if;
  if a.status <> 'active' or a.expires_at <= now() then raise exception 'ACTIVATION_EXPIRED'; end if;
  select * into pk from public.packages where id = a.package_id;
  select count(*) into v_today_count from public.submissions where activation_id = a.id and submitted_on = v_today and status <> 'rejected';
  if v_today_count >= pk.max_posts_per_day then raise exception 'DAILY_LIMIT_REACHED'; end if;
  if a.approved_posts >= pk.max_rewarded_posts then raise exception 'REWARD_CAP_REACHED'; end if;

  select count(*) into v_dupes from public.submissions where file_sha256 = p_sha256;
  if v_dupes > 0 then flags := flags || '"duplicate_image"'::jsonb; score := score + 60; end if;
  select count(*) into v_recent from public.submissions where user_id = p_user_id and created_at > now() - interval '10 minutes';
  if v_recent >= 2 then flags := flags || '"rapid_submissions"'::jsonb; score := score + 20; end if;
  if p_size < 30000 then flags := flags || '"tiny_file"'::jsonb; score := score + 20; end if;
  if a.starts_at > now() - interval '12 hours' then flags := flags || '"too_soon_after_activation"'::jsonb; score := score + 15; end if;

  insert into public.submissions (activation_id, user_id, campaign_id, storage_path, file_sha256, file_size_bytes, mime_type, note, status, fraud_flags, fraud_score, submitted_on)
  values (a.id, p_user_id, a.campaign_id, p_storage_path, p_sha256, p_size, p_mime, p_note,
          case when score >= 50 then 'flagged' else 'pending' end, flags, score, v_today)
  returning * into s;
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user_id, 'submission', 'Screenshot received', 'Your proof is in the review queue. You will be notified once it is verified.', '/dashboard/submissions');
  perform public.log_audit(p_user_id, 'user', 'submission.created', 'submission', s.id, jsonb_build_object('flags', flags, 'score', score));
  return s;
end; $$;

create or replace function public.review_submission(p_reviewer uuid, p_submission_id uuid, p_decision text, p_note text)
returns public.submissions language plpgsql security definer set search_path = public as $$
declare s public.submissions%rowtype; a public.activations%rowtype; pk public.packages%rowtype; v_bal int; v_reward int;
begin
  if not public.has_role(p_reviewer,'admin') then raise exception 'FORBIDDEN'; end if;
  select * into s from public.submissions where id = p_submission_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if s.status in ('approved','rejected') then raise exception 'ALREADY_REVIEWED'; end if;
  select * into a from public.activations where id = s.activation_id for update;
  select * into pk from public.packages where id = a.package_id;
  if p_decision = 'approve' then
    if a.approved_posts >= pk.max_rewarded_posts then raise exception 'REWARD_CAP_REACHED'; end if;
    v_reward := pk.reward_per_post_kes;
    update public.activations set approved_posts = approved_posts + 1 where id = a.id;
    update public.wallets set balance_kes = balance_kes + v_reward, lifetime_earned_kes = lifetime_earned_kes + v_reward
      where user_id = s.user_id returning balance_kes into v_bal;
    insert into public.wallet_transactions (user_id, type, amount_kes, balance_after_kes, ref_type, ref_id, description)
      values (s.user_id, 'reward', v_reward, v_bal, 'submission', s.id, format('Verified-engagement reward — %s post approved', pk.name));
    update public.submissions set status='approved', reward_kes=v_reward, reviewer_id=p_reviewer, review_note=p_note, reviewed_at=now() where id=s.id returning * into s;
    insert into public.notifications (user_id, kind, title, body, link)
      values (s.user_id, 'wallet', 'Post approved — reward credited', format('KES %s has been added to your wallet.', v_reward), '/dashboard/wallet');
  elsif p_decision = 'reject' then
    update public.submissions set status='rejected', reviewer_id=p_reviewer, review_note=p_note, reviewed_at=now() where id=s.id returning * into s;
    insert into public.notifications (user_id, kind, title, body, link)
      values (s.user_id, 'submission', 'Screenshot not approved', coalesce(nullif(p_note,''), 'The proof did not meet the campaign requirements.'), '/dashboard/submissions');
  else raise exception 'INVALID_DECISION'; end if;
  perform public.log_audit(p_reviewer, 'admin', 'submission.'||p_decision, 'submission', s.id, jsonb_build_object('note', p_note, 'reward_kes', v_reward));
  return s;
end; $$;

create or replace function public.request_withdrawal(p_user_id uuid, p_amount integer, p_phone text)
returns public.withdrawals language plpgsql security definer set search_path = public as $$
declare w public.wallets%rowtype; v_min int; wd public.withdrawals%rowtype; v_open int;
begin
  select (value)::int into v_min from public.app_settings where key='min_withdrawal_kes';
  if p_amount < coalesce(v_min,0) then raise exception 'BELOW_MINIMUM'; end if;
  select count(*) into v_open from public.withdrawals where user_id=p_user_id and status='requested';
  if v_open > 0 then raise exception 'PENDING_WITHDRAWAL_EXISTS'; end if;
  select * into w from public.wallets where user_id = p_user_id for update;
  if w.balance_kes < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;
  update public.wallets set balance_kes = balance_kes - p_amount, pending_kes = pending_kes + p_amount where user_id=p_user_id returning * into w;
  insert into public.withdrawals (user_id, amount_kes, phone) values (p_user_id, p_amount, p_phone) returning * into wd;
  insert into public.wallet_transactions (user_id, type, amount_kes, balance_after_kes, ref_type, ref_id, description)
    values (p_user_id, 'withdrawal_hold', -p_amount, w.balance_kes, 'withdrawal', wd.id, 'Withdrawal requested — amount on hold');
  insert into public.notifications (user_id, kind, title, body, link)
    values (p_user_id, 'withdrawal', 'Withdrawal requested', format('KES %s is on hold pending admin processing to %s.', p_amount, p_phone), '/dashboard/wallet');
  perform public.log_audit(p_user_id, 'user', 'withdrawal.requested', 'withdrawal', wd.id, jsonb_build_object('amount_kes', p_amount));
  return wd;
end; $$;

create or replace function public.process_withdrawal(p_admin uuid, p_withdrawal_id uuid, p_decision text, p_note text, p_receipt text)
returns public.withdrawals language plpgsql security definer set search_path = public as $$
declare wd public.withdrawals%rowtype; w public.wallets%rowtype;
begin
  if not public.has_role(p_admin,'admin') then raise exception 'FORBIDDEN'; end if;
  select * into wd from public.withdrawals where id=p_withdrawal_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if wd.status <> 'requested' then raise exception 'ALREADY_PROCESSED'; end if;
  if p_decision = 'paid' then
    update public.wallets set pending_kes = pending_kes - wd.amount_kes, lifetime_withdrawn_kes = lifetime_withdrawn_kes + wd.amount_kes where user_id=wd.user_id returning * into w;
    insert into public.wallet_transactions (user_id, type, amount_kes, balance_after_kes, ref_type, ref_id, description)
      values (wd.user_id, 'withdrawal_paid', 0, w.balance_kes, 'withdrawal', wd.id, format('Withdrawal of KES %s paid to %s', wd.amount_kes, wd.phone));
    update public.withdrawals set status='paid', admin_note=p_note, mpesa_receipt=p_receipt, processed_by=p_admin, processed_at=now() where id=wd.id returning * into wd;
    insert into public.notifications (user_id, kind, title, body, link)
      values (wd.user_id, 'withdrawal', 'Withdrawal paid', format('KES %s was sent to %s.', wd.amount_kes, wd.phone), '/dashboard/wallet');
  elsif p_decision = 'reject' then
    update public.wallets set pending_kes = pending_kes - wd.amount_kes, balance_kes = balance_kes + wd.amount_kes where user_id=wd.user_id returning * into w;
    insert into public.wallet_transactions (user_id, type, amount_kes, balance_after_kes, ref_type, ref_id, description)
      values (wd.user_id, 'withdrawal_reversed', wd.amount_kes, w.balance_kes, 'withdrawal', wd.id, 'Withdrawal rejected — amount returned to balance');
    update public.withdrawals set status='rejected', admin_note=p_note, processed_by=p_admin, processed_at=now() where id=wd.id returning * into wd;
    insert into public.notifications (user_id, kind, title, body, link)
      values (wd.user_id, 'withdrawal', 'Withdrawal not processed', coalesce(nullif(p_note,''),'Your withdrawal request was declined and the amount returned to your balance.'), '/dashboard/wallet');
  else raise exception 'INVALID_DECISION'; end if;
  perform public.log_audit(p_admin, 'admin', 'withdrawal.'||p_decision, 'withdrawal', wd.id, jsonb_build_object('note', p_note, 'amount_kes', wd.amount_kes));
  return wd;
end; $$;

-- lock down privileged functions to service_role only
revoke execute on function public.confirm_order_paid(uuid,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.fail_order(uuid,text,jsonb) from public, anon, authenticated;
revoke execute on function public.create_submission(uuid,uuid,text,text,integer,text,text) from public, anon, authenticated;
revoke execute on function public.review_submission(uuid,uuid,text,text) from public, anon, authenticated;
revoke execute on function public.request_withdrawal(uuid,integer,text) from public, anon, authenticated;
revoke execute on function public.process_withdrawal(uuid,uuid,text,text,text) from public, anon, authenticated;
revoke execute on function public.expire_activations() from public, anon, authenticated;
revoke execute on function public.log_audit(uuid,text,text,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.confirm_order_paid(uuid,text,text,jsonb), public.fail_order(uuid,text,jsonb),
  public.create_submission(uuid,uuid,text,text,integer,text,text), public.review_submission(uuid,uuid,text,text),
  public.request_withdrawal(uuid,integer,text), public.process_withdrawal(uuid,uuid,text,text,text),
  public.expire_activations(), public.log_audit(uuid,text,text,text,uuid,jsonb) to service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, anon, service_role;