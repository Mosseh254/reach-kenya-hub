-- Ownership-checked policies for the private screenshots bucket
CREATE POLICY "screenshots: owner read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'screenshots'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

CREATE POLICY "screenshots: owner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "screenshots: owner update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'screenshots'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "screenshots: owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'screenshots'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);