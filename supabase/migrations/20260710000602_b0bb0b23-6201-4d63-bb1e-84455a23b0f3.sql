
CREATE POLICY "Authenticated can read bug screenshots" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'bug-screenshots');
CREATE POLICY "Users can upload own bug screenshots" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bug-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own bug screenshots" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bug-screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);
