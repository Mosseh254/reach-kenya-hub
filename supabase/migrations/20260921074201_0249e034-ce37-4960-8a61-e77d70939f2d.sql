create policy "campaign-assets: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'campaign-assets' and public.has_role(auth.uid(), 'admin'));
create policy "campaign-assets: admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'campaign-assets' and public.has_role(auth.uid(), 'admin'));
create policy "campaign-assets: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'campaign-assets' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'campaign-assets' and public.has_role(auth.uid(), 'admin'));
create policy "campaign-assets: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'campaign-assets' and public.has_role(auth.uid(), 'admin'));