
UPDATE storage.buckets SET public = false WHERE id = 'manhwa';
-- SELECT policy already permits reading any object in the bucket via direct URL, which keeps getPublicUrl working,
-- but disabling the public flag prevents the bucket-listing endpoint from enumerating objects.
