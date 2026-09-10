create or replace function public.release_approved_rewards()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  u record;
  s record;
  v_balance integer;
  v_total integer;
  v_released integer := 0;
begin
  for u in
    select distinct user_id
    from public.submissions sub
    where sub.status = 'approved'
      and coalesce(sub.reward_kes, 0) > 0
      and not exists (
        select 1 from public.wallet_transactions t
        where t.ref_type = 'submission' and t.ref_id = sub.id
      )
  loop
    select balance_kes into v_balance from public.wallets where user_id = u.user_id for update;
    if v_balance is null then
      continue;
    end if;
    v_total := 0;

    for s in
      select sub.id, coalesce(sub.reward_kes, 0) as amount
      from public.submissions sub
      where sub.status = 'approved'
        and sub.user_id = u.user_id
        and coalesce(sub.reward_kes, 0) > 0
        and not exists (
          select 1 from public.wallet_transactions t
          where t.ref_type = 'submission' and t.ref_id = sub.id
        )
      order by sub.reviewed_at nulls last
    loop
      v_balance := v_balance + s.amount;
      v_total := v_total + s.amount;
      v_released := v_released + 1;
      insert into public.wallet_transactions
        (user_id, type, amount_kes, balance_after_kes, ref_type, ref_id, description)
      values
        (u.user_id, 'reward', s.amount, v_balance, 'submission', s.id,
         'Approved reward released to wallet');
    end loop;

    if v_total > 0 then
      update public.wallets
        set balance_kes = v_balance,
            lifetime_earned_kes = lifetime_earned_kes + v_total,
            updated_at = now()
        where user_id = u.user_id;

      insert into public.notifications (user_id, kind, title, body, link)
      values (u.user_id, 'wallet', 'Rewards released to your wallet',
        'KES ' || v_total || ' from approved posts is now available in your wallet.', '/wallet');

      perform public.log_audit(null, 'system', 'rewards.auto_released', 'user', u.user_id,
        jsonb_build_object('amount_kes', v_total));
    end if;
  end loop;

  return v_released;
end;
$$;

revoke all on function public.release_approved_rewards() from public;
revoke all on function public.release_approved_rewards() from anon;
revoke all on function public.release_approved_rewards() from authenticated;
grant execute on function public.release_approved_rewards() to service_role;