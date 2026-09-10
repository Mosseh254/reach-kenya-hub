create extension if not exists pg_net with schema extensions;

create or replace function public.relay_http_post(p_url text, p_headers jsonb, p_body jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare rid bigint;
begin
  select net.http_post(
    url := p_url,
    body := p_body,
    headers := p_headers,
    timeout_milliseconds := 25000
  ) into rid;
  return rid;
end;
$$;

create or replace function public.relay_http_result(p_request_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare r record;
begin
  select status_code, content, error_msg into r
  from net._http_response where id = p_request_id;
  if not found then
    return null;
  end if;
  return jsonb_build_object('status', r.status_code, 'body', r.content, 'error', r.error_msg);
end;
$$;

revoke all on function public.relay_http_post(text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.relay_http_result(bigint) from public, anon, authenticated;
grant execute on function public.relay_http_post(text, jsonb, jsonb) to service_role;
grant execute on function public.relay_http_result(bigint) to service_role;