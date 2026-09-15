CREATE OR REPLACE FUNCTION public.review_submission(p_reviewer uuid, p_submission_id uuid, p_decision text, p_note text)
 RETURNS submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare s public.submissions%rowtype; a public.activations%rowtype; pk public.packages%rowtype; v_bal int; v_reward int;
begin
  if auth.uid() is not null and auth.uid() <> p_reviewer then raise exception 'FORBIDDEN'; end if;
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
end; $function$;

GRANT EXECUTE ON FUNCTION public.review_submission(uuid, uuid, text, text) TO authenticated;