-- Sprint 3C.1: productos de tipo premium vinculados a un plan, y bandera
-- include_future_tracks para paquetes (album/catalog). Cuando la bandera es
-- false solo se entregan las pistas congeladas en el snapshot de la orden;
-- cuando es true, la aprobación entrega el contenido publicado vigente del
-- paquete (modelo-datos-v2.md §4).

-- +goose Up
alter table products drop constraint if exists products_product_type_check;

alter table products
  add column plan_id uuid references plans (id) on delete restrict,
  add column include_future_tracks boolean not null default false;

alter table products
  add constraint products_product_type_check
  check (product_type in ('track', 'album', 'catalog', 'premium'));

-- Solo un producto premium referencia un plan; el resto nunca.
alter table products
  add constraint products_premium_plan_check
  check ((product_type = 'premium') = (plan_id is not null));

-- +goose Down
alter table products drop constraint products_premium_plan_check;

-- El down debe poder correr dentro de `goose reset`: sin datos premium no hay
-- violación de la restricción histórica. Las ofertas caen en cascada y las
-- órdenes conservan sus snapshots (product_id/offer_id quedan en NULL).
delete from products where product_type = 'premium';

alter table products drop constraint products_product_type_check;
alter table products
  add constraint products_product_type_check
  check (product_type in ('track', 'album', 'catalog'));
alter table products drop column include_future_tracks, drop column plan_id;
