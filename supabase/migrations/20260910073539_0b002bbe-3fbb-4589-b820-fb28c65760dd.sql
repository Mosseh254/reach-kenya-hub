create or replace function public.release_approved_rewards()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_balance integer;
  v_total integer;
  v_count integer := 0;
begin
  for r in
    select s.user_id, sum(coalesce(s.reward_kes, 0)) as amount, count(*) as n
    from public.submissions s
    where s.status = 'approved'
      and coalesce(s.reward_kes, 0) > 0
      and not exists (
        select 1 from public.wallet_transactions t
        where t.ref_type = 'submission' and t.ref_id = s.id
      )
    group by s.user_id
  loop
    select balance_kes into v_balance from public.wallets where user_id = r.user_id for update;
    if v_balance is null then
      continue;
    end if;
    v_total := 0;
    for v_balance, v_total in
      select 0, 0
    loop
    end loop;
    v_total := 0;
    select balance_kes into v_balance from public.wallets where user_id = r.user_id;

    -- credit each uncredited approved submission individually
    for v_count in select 1 loop exit; end loop;

    perform 1;

    declare
      s record;
    begin
      for s in
        select id, coalesce(reward_kes, 0) as amount
        from public.submissions
        where status = 'approved'
          and user_id = r.user_id
          and coalesce(reward_kes, 0) > 0
          and not exists (
            select 1 from public.wallet_transactions t
            where t.ref_type = 'submission' and t.ref_id = submissions.id
          )
        order by reviewed_at nulls last
      loop
        v_balance := v_balance + s.amount;
        v_total := v_total + s.amount;
        insert into public.wallet_transactions
          (user_id, type, amount_kes, balance_after_kes, ref_type, ref_id, description)
        values
          (r.user_id, 'reward', s.amount, v_balance, 'submission', s.id,
           'Approved reward released to wallet');
      end loop;
    end;

    if v_total > 0 then
      update public.wallets
        set balance_kes = v_balance,
            lifetime_earned_kes = lifetime_earned_kes + v_total,
            updated_at = now()
        where user_id = r.user_id;

      insert into public.notifications (user_id, kind, title, body, link)
      values (r.user_id, 'wallet', 'Rewards released to your wallet',
        'KES ' || v_total || ' from approved posts is now available in your wallet.', '/wallet');

      perform public.log_audit(null, 'system', 'rewards.auto_released', 'user', r.user_id,
        jsonb_build_object('amount_kes', v_total));
    end if;
  end loop;

  select count(*) into v_count
  from public.wallet_transactions
  where ref_type = 'submission' and created_at > now() - interval '1 minute';

  return v_count;
end;
$$;

revoke all on function public.release_approved_rewards() from anon, authenticated;
grant execute on function public.release_approved_rewards() to service_role;