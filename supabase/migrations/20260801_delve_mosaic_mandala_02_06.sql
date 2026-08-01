-- Add Mosaic Mandala 02-06 to the Delve background pool.
-- Files live in the public-assets bucket under delve-backgrounds/mosaic-mandala-0X/.
-- The game falls back to its bundled default if a storage object is missing,
-- so registering rows ahead of the upload is safe.

INSERT INTO delve_backgrounds (storage_path, title, sort_order) VALUES
  ('delve-backgrounds/mosaic-mandala-02/mosaic-mandala-02.jpg', 'Mosaic Mandala 02', 2),
  ('delve-backgrounds/mosaic-mandala-03/mosaic-mandala-03.jpg', 'Mosaic Mandala 03', 3),
  ('delve-backgrounds/mosaic-mandala-04/mosaic-mandala-04.jpg', 'Mosaic Mandala 04', 4),
  ('delve-backgrounds/mosaic-mandala-05/mosaic-mandala-05.jpg', 'Mosaic Mandala 05', 5),
  ('delve-backgrounds/mosaic-mandala-06/mosaic-mandala-06.jpg', 'Mosaic Mandala 06', 6);
