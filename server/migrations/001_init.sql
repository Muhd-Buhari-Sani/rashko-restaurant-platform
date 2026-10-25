create table branches (
  id serial primary key,
  slug text unique not null,
  name text not null,
  address text,
  phone text,
  hours text,
  services text[],
  services_note text,
  active boolean not null default true,
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  delivery_fee integer check (delivery_fee >= 0),      -- naira; null = use the restaurant default
  min_order integer not null default 0 check (min_order >= 0),
  created_at timestamptz not null default now()
);

create table categories (
  id serial primary key,
  slug text unique not null,
  name text not null,
  blurb text,
  sort integer not null default 0
);

-- Global catalogue of dishes. Prices live per branch in branch_menu.
create table menu_items (
  id serial primary key,
  slug text unique not null,
  name text not null,
  note text,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table branch_menu (
  branch_id integer not null references branches(id) on delete cascade,
  item_id integer not null references menu_items(id) on delete cascade,
  category_id integer references categories(id) on delete set null,
  price integer check (price >= 0),                    -- naira; null = price to be confirmed, cannot be ordered
  available boolean not null default true,
  featured boolean not null default false,
  sort integer not null default 0,
  primary key (branch_id, item_id)
);

create table customers (
  id serial primary key,
  name text not null,
  phone text unique not null,
  email text,
  created_at timestamptz not null default now()
);

create table orders (
  id serial primary key,
  code text unique not null,
  branch_id integer not null references branches(id),
  customer_id integer not null references customers(id),
  type text not null check (type in ('delivery','pickup')),
  status text not null default 'pending_payment'
    check (status in ('pending_payment','received','preparing','ready','out_for_delivery','completed','cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid','refund_due','refunded')),
  customer_name text not null,
  customer_phone text not null,
  delivery_address text,
  notes text,
  subtotal integer not null,
  delivery_fee integer not null default 0,
  total integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_branch_status on orders(branch_id, status);
create index orders_created on orders(created_at desc);

-- Names and prices are copied at order time so later menu edits never change past orders.
create table order_items (
  id serial primary key,
  order_id integer not null references orders(id) on delete cascade,
  item_id integer references menu_items(id) on delete set null,
  name text not null,
  unit_price integer not null,
  qty integer not null check (qty > 0),
  line_total integer not null
);
create index order_items_order on order_items(order_id);

create table order_events (
  id serial primary key,
  order_id integer not null references orders(id) on delete cascade,
  status text not null,
  note text,
  admin_id integer,
  at timestamptz not null default now()
);

create table payments (
  id serial primary key,
  order_id integer not null references orders(id) on delete cascade,
  provider text not null,
  reference text unique not null,
  amount integer not null,
  status text not null default 'pending' check (status in ('pending','success','failed','abandoned','refunded')),
  channel text,
  raw jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index payments_order on payments(order_id);

create table admin_users (
  id serial primary key,
  email text unique not null,
  name text not null,
  password_hash text not null,
  role text not null check (role in ('administrator','branch_manager','order_manager')),
  branch_id integer references branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table notifications (
  id serial primary key,
  order_id integer references orders(id) on delete set null,
  channel text not null,
  recipient text not null,
  body text not null,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);
