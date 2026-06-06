-- Prevent duplicate activity rows; makes ON CONFLICT DO NOTHING reliable.
ALTER TABLE activities ADD CONSTRAINT activities_category_subcategory_unique UNIQUE (category, subcategory);
