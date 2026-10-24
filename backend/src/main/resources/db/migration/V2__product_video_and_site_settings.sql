alter table products add column video_url varchar(500);

alter table product_media drop constraint product_media_kind_chk;
alter table product_media
    add constraint product_media_kind_chk check (kind in ('PHOTO', 'SCREENSHOT', 'DOCUMENT', 'VIDEO'));

-- Values edited from the admin panel; anything missing falls back to application properties.
create table site_settings (
    key        varchar(80) primary key,
    value      text,
    updated_at timestamptz not null default now()
);
