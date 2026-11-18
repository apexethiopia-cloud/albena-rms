-- Albena RMS — Phase 3 reference data
-- Locations (INV-03), categories (INV-02) and units (ADR-010). Idempotent.
-- Apply after 20261118000300_master_data.sql.

insert into public.stock_locations (code, name) values
  ('MAIN_STORE',   'Main Store'),
  ('KITCHEN_STORE','Kitchen Store'),
  ('BAR_STORE',    'Bar Store'),
  ('COFFEE_STORE', 'Coffee Shop Store')
on conflict (code) do update set name = excluded.name;

insert into public.item_categories (name, sort_order) values
  ('Meat',             10),
  ('Poultry',          20),
  ('Seafood',          30),
  ('Vegetables',       40),
  ('Dairy',            50),
  ('Dry Goods',        60),
  ('Beverages',        70),
  ('Packaging',        80),
  ('Cleaning Supplies',90)
on conflict (name) do update set sort_order = excluded.sort_order;

-- Fixed units carry a global factor. Box / carton / sack have base_factor = NULL:
-- their size is entered per item in item_unit_conversions (CON-07, ADR-010).
insert into public.units (code, name, dimension, is_base, base_factor) values
  ('g',      'Gram',       'mass',   true,  1),
  ('kg',     'Kilogram',   'mass',   false, 1000),
  ('ml',     'Millilitre', 'volume', true,  1),
  ('l',      'Litre',      'volume', false, 1000),
  ('piece',  'Piece',      'count',  true,  1),
  ('bottle', 'Bottle',     'count',  false, 1),
  ('box',    'Box',        'count',  false, null),
  ('carton', 'Carton',     'count',  false, null),
  ('sack',   'Sack',       'mass',   false, null)
on conflict (code) do update
  set name = excluded.name,
      dimension = excluded.dimension,
      is_base = excluded.is_base,
      base_factor = excluded.base_factor;
