/** A small, original shop schema to practise joins and aggregates on. Loading it replaces only these tables. */
export const SAMPLE_SQL = `DROP TABLE IF EXISTS order_items, orders, products, customers CASCADE;
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, city text NOT NULL, joined date NOT NULL);
CREATE TABLE products (id int PRIMARY KEY, name text NOT NULL, category text NOT NULL, price numeric(8,2) NOT NULL);
CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL REFERENCES customers, ordered_on date NOT NULL, total numeric(10,2) NOT NULL);
CREATE TABLE order_items (order_id int REFERENCES orders, product_id int REFERENCES products, quantity int NOT NULL CHECK (quantity > 0), PRIMARY KEY (order_id, product_id));
INSERT INTO customers VALUES
  (1, 'Ana Pereira', 'Lisbon', '2025-01-14'), (2, 'Ben Okafor', 'Lagos', '2025-02-03'), (3, 'Chloé Martin', 'Lyon', '2025-03-21'),
  (4, 'Dev Patel', 'Pune', '2025-04-09'), (5, 'Eva Novak', 'Brno', '2025-06-30');
INSERT INTO products VALUES
  (1, 'Trail mug', 'kitchen', 12.50), (2, 'Desk lamp', 'office', 34.00), (3, 'Notebook', 'office', 4.75),
  (4, 'Tea sampler', 'kitchen', 18.00), (5, 'Cable tidy', 'office', 6.25), (6, 'Water bottle', 'outdoor', 15.00);
INSERT INTO orders VALUES
  (101, 1, '2025-07-01', 29.75), (102, 2, '2025-07-02', 34.00), (103, 1, '2025-07-09', 18.00),
  (104, 3, '2025-07-15', 21.25), (105, 4, '2025-08-02', 49.00), (106, 2, '2025-08-11', 9.50);
INSERT INTO order_items VALUES
  (101, 1, 1), (101, 5, 1), (101, 3, 2), (102, 2, 1), (103, 4, 1), (104, 6, 1), (104, 5, 1),
  (105, 2, 1), (105, 6, 1), (106, 3, 2);
SELECT 'customers' AS "table", count(*) AS "rows" FROM customers
UNION ALL SELECT 'products', count(*) FROM products
UNION ALL SELECT 'orders', count(*) FROM orders
UNION ALL SELECT 'order_items', count(*) FROM order_items;`
