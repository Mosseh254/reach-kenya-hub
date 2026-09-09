UPDATE public.packages
SET duration_days = CASE slug WHEN 'bronze' THEN 7 WHEN 'silver' THEN 10 WHEN 'gold' THEN 14 ELSE duration_days END,
    max_rewarded_posts = CASE slug WHEN 'bronze' THEN 7 WHEN 'silver' THEN 10 WHEN 'gold' THEN 14 ELSE max_rewarded_posts END,
    features = CASE slug
      WHEN 'bronze' THEN '["7-day campaign window","1 post per day","KES 20 per View","Campaign materials pack"]'::jsonb
      WHEN 'silver' THEN '["10-day campaign window","1  post per day","KES 30 per View"]'::jsonb
      WHEN 'gold' THEN '["14-day campaign window","1  post per day","KES 45 per View"]'::jsonb
      ELSE features
    END
WHERE slug IN ('bronze', 'silver', 'gold');