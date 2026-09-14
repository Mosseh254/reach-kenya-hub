CREATE OR REPLACE FUNCTION public.create_submission(p_user_id uuid, p_activation_id uuid, p_storage_path text, p_sha256 text, p_size integer, p_mime text, p_note text)
 RETURNS submissions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
          (case when score >= 50 then 'flagged' else 'pending' end)::public.submission_status, flags, score, v_today)
  returning * into s;
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user_id, 'submission', 'Screenshot received', 'Your proof is in the review queue. You will be notified once it is verified.', '/dashboard/submissions');
  perform public.log_audit(p_user_id, 'user', 'submission.created', 'submission', s.id, jsonb_build_object('flags', flags, 'score', score));
  return s;
end; $function$;