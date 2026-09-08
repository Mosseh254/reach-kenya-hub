revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;

drop policy "settings: public read" on public.app_settings;
create policy "settings: anon read public" on public.app_settings for select to anon using (is_public);
create policy "settings: auth read" on public.app_settings for select to authenticated using (is_public or public.has_role(auth.uid(),'admin'));

drop policy "packages: public read active" on public.packages;
create policy "packages: anon read active" on public.packages for select to anon using (is_active);
create policy "packages: auth read" on public.packages for select to authenticated using (is_active or public.has_role(auth.uid(),'admin'));

drop policy "advertisers: public read" on public.advertisers;
create policy "advertisers: anon read active" on public.advertisers for select to anon using (is_active);
create policy "advertisers: auth read" on public.advertisers for select to authenticated using (is_active or public.has_role(auth.uid(),'admin'));

drop policy "campaigns: public read" on public.campaigns;
create policy "campaigns: anon read active" on public.campaigns for select to anon using (is_active);
create policy "campaigns: auth read" on public.campaigns for select to authenticated using (is_active or public.has_role(auth.uid(),'admin'));