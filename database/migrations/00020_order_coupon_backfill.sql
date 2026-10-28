-- Completa la referencia normalizada del cupón en órdenes creadas por 0.7.0.
-- coupon_uses es la fuente porque vincula una orden con el cupón aplicado.

-- +goose Up
update orders o
set coupon_id = cu.coupon_id
from coupon_uses cu
where cu.order_id = o.id
  and o.coupon_id is null;

-- +goose Down
update orders o
set coupon_id = null
from coupon_uses cu
where cu.order_id = o.id
  and o.coupon_id = cu.coupon_id;
