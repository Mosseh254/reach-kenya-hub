-- ============ Guarded wrappers so signed-in admins/members can run privileged flows ============
-- auth.uid() IS NULL means a trusted server-key caller.

create or replace function public.app_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is null or public.has_role(auth.uid(), 'admin')
$$;

create or replace function public.app_expire_activations()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.role() = 'authenticated' then
    return public.expire_activations();
  end if;
  raise exception 'FORBIDDEN';
end; $$;

create or replace function public.app_log_audit(p_actor uuid, p_actor_type text, p_action text, p_entity_type text, p_entity_id uuid, p_meta jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (auth.uid() is null or auth.uid() = p_actor or public.has_role(auth.uid(), 'admin')) then
    raise exception 'FORBIDDEN';
  end if;
  perform public.log_audit(p_actor, p_actor_type, p_action, p_entity_type, p_entity_id, p_meta);
end; $$;

create or replace function public.app_create_submission(p_user_id uuid, p_activation_id uuid, p_storage_path text, p_sha256 text, p_size integer, p_mime text, p_note text)
returns public.submissions language plpgsql security definer set search_path = public as $$
begin
  if not (auth.uid() is null or auth.uid() = p_user_id) then raise exception 'FORBIDDEN'; end if;
  return public.create_submission(p_user_id, p_activation_id, p_storage_path, p_sha256, p_size, p_mime, p_note);
end; $$;

create or replace function public.app_request_withdrawal(p_user_id uuid, p_amount integer, p_phone text)
returns public.withdrawals language plpgsql security definer set search_path = public as $$
begin
  if not (auth.uid() is null or auth.uid() = p_user_id or public.has_role(auth.uid(), 'admin')) then
    raise exception 'FORBIDDEN';
  end if;
  return public.request_withdrawal(p_user_id, p_amount, p_phone);
end; $$;

create or replace function public.app_review_submission(p_reviewer uuid, p_submission_id uuid, p_decision text, p_note text)
returns public.submissions language plpgsql security definer set search_path = public as $$
begin
  if not public.app_is_admin() then raise exception 'FORBIDDEN'; end if;
  if auth.uid() is not null and auth.uid() <> p_reviewer then raise exception 'FORBIDDEN'; end if;
  return public.review_submission(p_reviewer, p_submission_id, p_decision, p_note);
end; $$;

create or replace function public.app_process_withdrawal(p_admin uuid, p_withdrawal_id uuid, p_decision text, p_note text, p_receipt text)
returns public.withdrawals language plpgsql security definer set search_path = public as $$
begin
  if not public.app_is_admin() then raise exception 'FORBIDDEN'; end if;
  if auth.uid() is not null and auth.uid() <> p_admin then raise exception 'FORBIDDEN'; end if;
  return public.process_withdrawal(p_admin, p_withdrawal_id, p_decision, p_note, p_receipt);
end; $$;

create or replace function public.app_release_approved_rewards()
returns integer language plpgsql security definer set search_path = public as $$
begin
  if not public.app_is_admin() then raise exception 'FORBIDDEN'; end if;
  return public.release_approved_rewards();
end; $$;

create or replace function public.app_fail_order(p_order_id uuid, p_reason text, p_payload jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.orders where id = p_order_id;
  if not (public.app_is_admin() or v_owner = auth.uid()) then raise exception 'FORBIDDEN'; end if;
  perform public.fail_order(p_order_id, p_reason, p_payload);
end; $$;

create or replace function public.app_confirm_order_paid(p_order_id uuid, p_provider_ref text, p_receipt text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_mock boolean;
begin
  select user_id into v_owner from public.orders where id = p_order_id;
  select coalesce((value #>> '{}') = 'mock', false) into v_mock from public.app_settings where key = 'mpesa_mode';
  if not (public.app_is_admin() or (v_owner = auth.uid() and coalesce(v_mock, false))) then
    raise exception 'FORBIDDEN';
  end if;
  return public.confirm_order_paid(p_order_id, p_provider_ref, p_receipt, p_payload);
end; $$;

revoke all on function public.app_is_admin() from public;
grant execute on function public.app_is_admin() to authenticated, service_role;
grant execute on function public.app_expire_activations() to authenticated, service_role;
grant execute on function public.app_log_audit(uuid, text, text, text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.app_create_submission(uuid, uuid, text, text, integer, text, text) to authenticated, service_role;
grant execute on function public.app_request_withdrawal(uuid, integer, text) to authenticated, service_role;
grant execute on function public.app_review_submission(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.app_process_withdrawal(uuid, uuid, text, text, text) to authenticated, service_role;
grant execute on function public.app_release_approved_rewards() to authenticated, service_role;
grant execute on function public.app_fail_order(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.app_confirm_order_paid(uuid, text, text, jsonb) to authenticated, service_role;

-- ============ Admin write access through RLS (works with the admin's own login) ============
grant insert, update, delete on public.packages to authenticated;
create policy "packages: admin write" on public.packages for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

grant insert, update, delete on public.app_settings to authenticated;
create policy "settings: admin write" on public.app_settings for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

grant insert, update, delete on public.advertisers to authenticated;
create policy "advertisers: admin write" on public.advertisers for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

grant insert, update, delete on public.campaigns to authenticated;
create policy "campaigns: admin write" on public.campaigns for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

grant insert, update, delete on public.campaign_materials to authenticated;
create policy "materials: admin write" on public.campaign_materials for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

grant insert, update, delete on public.user_roles to authenticated;
create policy "roles: admin write" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

grant insert on public.wallet_transactions to authenticated;
create policy "wallet_tx: admin insert" on public.wallet_transactions for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

grant update on public.wallets to authenticated;
create policy "wallets: admin update" on public.wallets for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

grant insert on public.notifications to authenticated;
create policy "notifications: admin insert" on public.notifications for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

grant insert, update on public.orders to authenticated;
create policy "orders: own insert" on public.orders for insert to authenticated
  with check (auth.uid() = user_id);
create policy "orders: own pending update" on public.orders for update to authenticated
  using ((auth.uid() = user_id and status = 'pending') or public.has_role(auth.uid(), 'admin'))
  with check ((auth.uid() = user_id and status = 'pending') or public.has_role(auth.uid(), 'admin'));

grant insert on public.payment_events to authenticated;
create policy "payment_events: own order insert" on public.payment_events for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
  );

grant update on public.submissions to authenticated;
create policy "submissions: admin update" on public.submissions for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));