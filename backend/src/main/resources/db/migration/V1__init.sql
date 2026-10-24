create extension if not exists pg_trgm;

-- ============ users & auth ============
create table users (
    id            bigserial primary key,
    email         varchar(255) not null,
    password_hash varchar(100) not null,
    full_name     varchar(150) not null,
    phone         varchar(32),
    role          varchar(16)  not null default 'USER',
    partner       boolean      not null default false,
    enabled       boolean      not null default true,
    last_login_at timestamptz,
    created_at    timestamptz  not null default now(),
    updated_at    timestamptz  not null default now(),
    constraint users_role_chk check (role in ('USER', 'ADMIN'))
);
create unique index users_email_uq on users (lower(email));

create table refresh_tokens (
    id               bigserial primary key,
    user_id          bigint      not null references users (id) on delete cascade,
    token_hash       varchar(64) not null unique,
    family_id        uuid        not null,
    expires_at       timestamptz not null,
    revoked_at       timestamptz,
    replaced_by_hash varchar(64),
    user_agent       varchar(255),
    ip_address       varchar(64),
    created_at       timestamptz not null default now()
);
create index refresh_tokens_user_idx on refresh_tokens (user_id);
create index refresh_tokens_family_idx on refresh_tokens (family_id);

-- ============ catalog ============
create table categories (
    id             bigserial primary key,
    slug           varchar(80)  not null unique,
    name_ru        varchar(150) not null,
    name_kk        varchar(150),
    description_ru text,
    description_kk text,
    icon           varchar(40),
    sort_order     int          not null default 0,
    created_at     timestamptz  not null default now(),
    updated_at     timestamptz  not null default now()
);

create table brands (
    id          bigserial primary key,
    slug        varchar(80)  not null unique,
    name        varchar(120) not null,
    description text,
    created_at  timestamptz  not null default now(),
    updated_at  timestamptz  not null default now()
);
create unique index brands_name_uq on brands (lower(name));

create sequence product_sku_seq start with 5000;

create table products (
    id              bigserial primary key,
    sku             varchar(40)  not null unique,
    slug            varchar(200) not null unique,
    name_ru         varchar(255) not null,
    name_kk         varchar(255),
    summary_ru      varchar(600),
    summary_kk      varchar(600),
    description_ru  text,
    description_kk  text,
    usage_ru        text,
    usage_kk        text,
    composition     text,
    warnings_ru     text,
    warnings_kk     text,
    search_keywords varchar(1000),
    category_id     bigint references categories (id) on delete set null,
    brand_id        bigint references brands (id) on delete set null,
    price           numeric(12, 2),
    partner_price   numeric(12, 2),
    old_price       numeric(12, 2),
    currency        varchar(3)   not null default 'KZT',
    volume          varchar(60),
    stock_quantity  int,
    status          varchar(16)  not null default 'DRAFT',
    featured        boolean      not null default false,
    badge           varchar(60),
    catalog_page    int,
    cover_key       varchar(300),
    cover_thumb_key varchar(300),
    view_count      bigint       not null default 0,
    sold_count      bigint       not null default 0,
    version         bigint       not null default 0,
    created_by      bigint references users (id) on delete set null,
    published_at    timestamptz,
    created_at      timestamptz  not null default now(),
    updated_at      timestamptz  not null default now(),
    search_vector   tsvector generated always as (
        setweight(to_tsvector('russian', coalesce(name_ru, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(name_ru, '') || ' ' || coalesce(search_keywords, '') || ' ' || coalesce(sku, '')), 'A') ||
        setweight(to_tsvector('russian', coalesce(summary_ru, '')), 'B') ||
        setweight(to_tsvector('russian', coalesce(description_ru, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(name_kk, '')), 'B')
    ) stored,
    constraint products_status_chk check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    constraint products_price_chk check (price is null or price >= 0),
    constraint products_partner_price_chk check (partner_price is null or partner_price >= 0),
    constraint products_stock_chk check (stock_quantity is null or stock_quantity >= 0)
);
create index products_search_idx on products using gin (search_vector);
create index products_name_trgm_idx on products using gin (name_ru gin_trgm_ops);
create index products_category_idx on products (category_id);
create index products_brand_idx on products (brand_id);
create index products_status_idx on products (status);
create index products_price_idx on products (price);

create table product_benefits (
    product_id bigint       not null references products (id) on delete cascade,
    position   int          not null,
    text_ru    varchar(500) not null,
    text_kk    varchar(500),
    primary key (product_id, position)
);

create table product_attributes (
    product_id bigint       not null references products (id) on delete cascade,
    position   int          not null,
    name_ru    varchar(120) not null,
    value_ru   varchar(500) not null,
    name_kk    varchar(120),
    value_kk   varchar(500),
    primary key (product_id, position)
);

create table product_media (
    id                bigserial primary key,
    product_id        bigint       not null references products (id) on delete cascade,
    kind              varchar(16)  not null,
    storage_key       varchar(300) not null,
    thumbnail_key     varchar(300),
    original_filename varchar(255),
    content_type      varchar(120) not null,
    size_bytes        bigint       not null,
    width             int,
    height            int,
    title             varchar(200),
    description       text,
    alt_text          varchar(255),
    sort_order        int          not null default 0,
    is_cover          boolean      not null default false,
    created_at        timestamptz  not null default now(),
    constraint product_media_kind_chk check (kind in ('PHOTO', 'SCREENSHOT', 'DOCUMENT'))
);
create index product_media_product_idx on product_media (product_id, kind, sort_order);
create index product_media_storage_key_idx on product_media (storage_key);
create unique index product_media_single_cover_uq on product_media (product_id) where is_cover;

-- ============ orders ============
create sequence order_number_seq start with 1;

create table orders (
    id              bigserial primary key,
    number          varchar(24)    not null unique,
    user_id         bigint references users (id) on delete set null,
    customer_name   varchar(150)   not null,
    phone           varchar(32)    not null,
    email           varchar(255),
    city            varchar(100),
    address         varchar(300),
    comment         text,
    delivery_method varchar(16)    not null,
    payment_method  varchar(24)    not null,
    price_tier      varchar(16)    not null,
    status          varchar(16)    not null default 'NEW',
    items_total     numeric(12, 2) not null,
    savings_total   numeric(12, 2) not null default 0,
    delivery_fee    numeric(12, 2) not null default 0,
    total           numeric(12, 2) not null,
    currency        varchar(3)     not null default 'KZT',
    admin_note      text,
    created_at      timestamptz    not null default now(),
    updated_at      timestamptz    not null default now(),
    constraint orders_status_chk check (status in ('NEW', 'CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED')),
    constraint orders_delivery_chk check (delivery_method in ('PICKUP', 'DELIVERY')),
    constraint orders_tier_chk check (price_tier in ('RETAIL', 'PARTNER'))
);
create index orders_user_idx on orders (user_id, created_at desc);
create index orders_status_idx on orders (status, created_at desc);

create table order_items (
    id           bigserial primary key,
    order_id     bigint         not null references orders (id) on delete cascade,
    product_id   bigint references products (id) on delete set null,
    sku          varchar(40)    not null,
    product_name varchar(255)   not null,
    image_key    varchar(300),
    unit_price   numeric(12, 2) not null,
    retail_price numeric(12, 2) not null,
    quantity     int            not null check (quantity > 0),
    line_total   numeric(12, 2) not null
);
create index order_items_order_idx on order_items (order_id);
create index order_items_product_idx on order_items (product_id);

create table order_status_history (
    id         bigserial primary key,
    order_id   bigint      not null references orders (id) on delete cascade,
    status     varchar(16) not null,
    note       text,
    changed_by bigint references users (id) on delete set null,
    created_at timestamptz not null default now()
);
create index order_status_history_order_idx on order_status_history (order_id, created_at);
