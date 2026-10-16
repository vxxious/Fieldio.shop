-- The original image URL received a long-lived CDN 404 before deployment completed.
update public.product_images
set public_url = 'https://fieldio.shop/images/brand-catalog/zara/zara-boxers-01.webp?v=20261016'
where storage_path = 'brand-catalog/zara/zara-boxers-01.webp'
  and public_url = 'https://fieldio.shop/images/brand-catalog/zara/zara-boxers-01.webp';
