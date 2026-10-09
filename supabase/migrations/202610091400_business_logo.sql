BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_logo_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_ninea TEXT;
GRANT UPDATE (business_logo_url, business_ninea) ON public.profiles TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('business-logos', 'business-logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Owners upload business logos" ON storage.objects;
CREATE POLICY "Owners upload business logos" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.uid() = public.current_account_id()
  AND public.is_account_admin()
);

DROP POLICY IF EXISTS "Owners delete business logos" ON storage.objects;
CREATE POLICY "Owners delete business logos" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND auth.uid() = public.current_account_id()
  AND public.is_account_admin()
);

DROP POLICY IF EXISTS "Account members read business logos" ON storage.objects;
CREATE POLICY "Account members read business logos" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'business-logos'
  AND (storage.foldername(name))[1] = public.current_account_id()::text
);

COMMIT;
