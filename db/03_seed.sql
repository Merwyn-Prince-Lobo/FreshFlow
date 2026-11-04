-- FreshFlow: sample data (30 products, 60 batches). Dates are relative to today
-- so the expiry-risk screens and alerts always have something to show.
USE freshflow;

INSERT INTO APP_USER (Name, Email, Password_Hash, Role_ID) VALUES
 ('Merwyn Prince Lobo', 'admin@freshflow.local', 'RUN_npm_run_seed_users', 1),
 ('Lal Bee',            'staff@freshflow.local', 'RUN_npm_run_seed_users', 2);

INSERT INTO SUPPLIER (Supplier_Name, Contact_Person, Phone) VALUES
 ('Nandini Dairy',      'R. Gowda',  '9800000001'),
 ('Fresh Farms Produce','S. Rao',    '9800000002'),
 ('Baker''s Choice',    'A. Khan',   '9800000003'),
 ('Coastal Seafoods',   'M. D''Souza','9800000004'),
 ('Green Valley Foods', 'P. Nair',   '9800000005'),
 ('Sunrise Beverages',  'T. Iyer',   '9800000006');

INSERT INTO LOCATION (Location_Name, Location_Type, Min_Temp_C, Max_Temp_C) VALUES
 ('Main Warehouse', 'Warehouse', 10, 28),
 ('Cold Room 1',    'ColdRoom',   0,  5),
 ('Shop Shelf A',   'Shelf',     10, 30);

INSERT INTO PRODUCT (Product_Name, Description, Category, Unit_Of_Measure, Shelf_Life_Days, Reorder_Level, Selling_Price) VALUES
 ('Full Cream Milk 1L','Pasteurised packet milk','Dairy','pack',5,40,28.00),
 ('Curd 500g','Set curd cup','Dairy','cup',7,30,32.00),
 ('Paneer 200g','Fresh cottage cheese','Dairy','pack',10,20,85.00),
 ('Butter 100g','Salted table butter','Dairy','pack',90,15,58.00),
 ('Cheese Slices','Processed cheese slices','Dairy','pack',120,10,130.00),
 ('Tomato','Loose tomatoes','Produce','kg',6,25,40.00),
 ('Spinach','Leafy greens bunch','Produce','bunch',3,20,15.00),
 ('Banana','Robusta bananas','Produce','kg',5,25,50.00),
 ('Apple','Shimla apples','Produce','kg',14,20,180.00),
 ('Carrot','Ooty carrots','Produce','kg',10,20,55.00),
 ('White Bread','Sliced sandwich loaf','Bakery','loaf',4,30,45.00),
 ('Brown Bread','Whole wheat loaf','Bakery','loaf',4,20,55.00),
 ('Croissant','Butter croissant','Bakery','piece',2,15,60.00),
 ('Fruit Cake','Plum cake slice pack','Bakery','pack',10,10,90.00),
 ('Burger Buns','Pack of 4 buns','Bakery','pack',5,15,40.00),
 ('Chicken Breast','Fresh chicken breast','Meat','kg',3,15,290.00),
 ('Eggs Tray 30','Farm eggs','Meat','tray',21,15,190.00),
 ('Prawns 500g','Cleaned prawns','Seafood','pack',2,10,420.00),
 ('Fish Fillet','Basa fillet','Seafood','kg',3,10,350.00),
 ('Orange Juice 1L','Packaged juice','Beverage','bottle',60,20,110.00),
 ('Coconut Water','Tender coconut water','Beverage','bottle',30,20,45.00),
 ('Lassi 200ml','Sweet lassi','Beverage','bottle',15,25,30.00),
 ('Peanut Butter','Crunchy jar','Packaged','jar',180,10,220.00),
 ('Jam 500g','Mixed fruit jam','Packaged','jar',270,10,150.00),
 ('Corn Flakes','Breakfast cereal','Packaged','box',200,10,170.00),
 ('Hummus 200g','Chilled dip tub','Packaged','tub',14,10,120.00),
 ('Idli Batter 1kg','Fermented batter','Packaged','pack',4,25,60.00),
 ('Frozen Peas','Green peas 500g','Frozen','pack',150,15,95.00),
 ('Ice Cream Tub','Vanilla 500ml','Frozen','tub',120,10,210.00),
 ('Mayonnaise','Eggless mayo','Packaged','jar',150,10,130.00);

INSERT INTO PRODUCT_SUPPLIER (Product_ID, Supplier_ID)
SELECT Product_ID,
       CASE Category WHEN 'Dairy' THEN 1 WHEN 'Produce' THEN 2 WHEN 'Bakery' THEN 3
                     WHEN 'Meat' THEN 5 WHEN 'Seafood' THEN 4 WHEN 'Beverage' THEN 6
                     ELSE 5 END
  FROM PRODUCT;

-- One purchase per supplier holding two batches of each of its products
INSERT INTO PURCHASE (Supplier_ID, User_ID, Purchase_Date)
SELECT DISTINCT Supplier_ID, 1, CURDATE() - INTERVAL 5 DAY FROM PRODUCT_SUPPLIER;

-- Copy the ids first: a trigger on PURCHASE_ITEM updates PURCHASE, and MySQL
-- forbids reading a table in the same statement that fires a trigger on it.
CREATE TEMPORARY TABLE tmp_purchase AS SELECT Purchase_ID, Supplier_ID FROM PURCHASE;

INSERT INTO PURCHASE_ITEM (Purchase_ID, Product_ID, Location_ID, Batch_Number,
                           Mfg_Date, Expiry_Date, Quantity, Unit_Cost)
SELECT pu.Purchase_ID, p.Product_ID,
       CASE WHEN p.Category IN ('Dairy','Meat','Seafood','Frozen') THEN 2
            WHEN p.Category = 'Packaged' THEN 1 ELSE 3 END,
       CONCAT('B', LPAD(p.Product_ID,2,'0'), '-', b.n),
       CURDATE() - INTERVAL 5 DAY,
       -- batch 1 expires sooner than batch 2; some products are already near/past expiry
       GREATEST(CURDATE() - INTERVAL 5 DAY,   -- never before the manufacture date
                CURDATE() + INTERVAL (p.Shelf_Life_Days - 5 - (p.Product_ID MOD 4) * 2 + (b.n - 1) * 3) DAY),
       20 + (p.Product_ID * 7) MOD 40,
       ROUND(p.Selling_Price * 0.6, 2)
  FROM PRODUCT p
  JOIN PRODUCT_SUPPLIER ps ON ps.Product_ID = p.Product_ID
  JOIN tmp_purchase pu ON pu.Supplier_ID = ps.Supplier_ID
  JOIN (SELECT 1 AS n UNION ALL SELECT 2) b;

DROP TEMPORARY TABLE tmp_purchase;

-- Receive every seeded purchase (creates batches and movements via the procedure)
CALL sp_receive_purchase(1, 1);
CALL sp_receive_purchase(2, 1);
CALL sp_receive_purchase(3, 1);
CALL sp_receive_purchase(4, 1);
CALL sp_receive_purchase(5, 1);
CALL sp_receive_purchase(6, 1);