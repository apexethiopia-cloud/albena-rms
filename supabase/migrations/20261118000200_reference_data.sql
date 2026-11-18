-- Albena RMS — Phase 2 reference data
-- Roles from SRS section 3 and outlets from OUT-01. Idempotent.

insert into public.roles (code, name, description) values
  ('system_admin',        'System Administrator', 'System configuration, user and role administration, security settings'),
  ('general_manager',     'General Manager',      'All reports, dashboard, inventory monitoring and approval authority'),
  ('restaurant_manager',  'Restaurant Manager',   'Daily operations, sales, inventory and reservation monitoring'),
  ('purchasing_officer',  'Purchasing Officer',   'Purchase requests, purchase orders and supplier management'),
  ('storekeeper',         'Storekeeper',          'Inventory records, GRN, SIV and inventory counts'),
  ('executive_chef',      'Executive Chef',       'Recipes, production and food-cost monitoring'),
  ('kitchen_staff',       'Kitchen Staff',        'Kitchen display access and permitted order-status updates'),
  ('waiter',              'Waiter',               'Open tables, create and modify orders, transfer, split, print guest checks'),
  ('cashier',             'Cashier',              'Close orders, print receipts and prepare end-of-day summaries'),
  ('auditor',             'Auditor',              'Read-only access to authorised reports and audit logs')
on conflict (code) do update
  set name = excluded.name,
      description = excluded.description;

insert into public.outlets (code, name) values
  ('MAIN',    'Main Restaurant'),
  ('COFFEE',  'Coffee Shop'),
  ('POOL',    'Pool Bar'),
  ('ROOM',    'Room Service'),
  ('BANQUET', 'Banquet Hall')
on conflict (code) do update
  set name = excluded.name;
