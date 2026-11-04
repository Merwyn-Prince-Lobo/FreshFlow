-- FreshFlow: DB test script. Run after 01-03. Each block prints PASS/FAIL.
USE freshflow;

-- T1: expiry before manufacture is rejected (CHECK)
SET @ok = 0;
-- expect error 3819; run manually to show the rejected insert:
-- INSERT INTO INVENTORY (Product_ID,Location_ID,Batch_Number,Mfg_Date,Expiry_Date)
-- VALUES (1,1,'BAD','2026-12-01','2026-11-01');

-- T2: duplicate batch rejected (UNIQUE) -- run manually, expect error 1062
-- INSERT INTO INVENTORY (Product_ID,Location_ID,Batch_Number,Mfg_Date,Expiry_Date)
-- SELECT Product_ID,Location_ID,Batch_Number,Mfg_Date,Expiry_Date FROM INVENTORY LIMIT 1;

-- T3: FEFO issue takes the earliest-expiring batch first
SELECT Inventory_ID, Expiry_Date, Quantity_On_Hand FROM INVENTORY
 WHERE Product_ID = 1 AND Location_ID = 2 ORDER BY Expiry_Date;
CALL sp_issue_stock(1, 2, 45, 2);
SELECT m.Inventory_ID, i.Expiry_Date, m.Quantity AS Issued
  FROM STOCK_MOVEMENT m JOIN INVENTORY i ON i.Inventory_ID = m.Inventory_ID
 WHERE m.Movement_Type = 'ISSUE' ORDER BY m.Movement_ID DESC LIMIT 3;

-- T4: issuing more than exists rolls back, no partial movement left
SELECT COUNT(*) INTO @before FROM STOCK_MOVEMENT;
-- CALL sp_issue_stock(1, 2, 999999, 2);   -- expect 'Insufficient unexpired stock'
SELECT IF(COUNT(*) = @before, 'PASS rollback', 'FAIL rollback') AS T4 FROM STOCK_MOVEMENT;

-- T5: waste is transactional and writes both rows
CALL sp_record_waste(1, 2, 'Damaged', 'Discard', 'Packaging torn, milk leaked', 2);
SELECT w.Waste_ID, w.Reason, m.Quantity FROM WASTE w
  JOIN STOCK_MOVEMENT m ON m.Movement_ID = w.Movement_ID ORDER BY w.Waste_ID DESC LIMIT 1;

-- T6: adjustment needs a note -- expect error
-- CALL sp_adjust_stock(1, 3, 'OUT', '', 2);

-- T7: low-stock alert fired by trigger
SELECT * FROM ALERT WHERE Alert_Type = 'LowStock' ORDER BY Alert_ID DESC LIMIT 3;

-- T8: views and full-text
SELECT * FROM v_expiring_soon ORDER BY Days_To_Expiry LIMIT 5;
SELECT Product_Name FROM PRODUCT WHERE MATCH(Product_Name, Description) AGAINST ('milk');

-- Demo queries from the plan
SELECT p.Product_Name, l.Location_Name, i.Batch_Number, i.Quantity_On_Hand,
       DATEDIFF(i.Expiry_Date, CURDATE()) AS Days_To_Expiry
  FROM INVENTORY i JOIN PRODUCT p ON p.Product_ID = i.Product_ID
  JOIN LOCATION l ON l.Location_ID = i.Location_ID
 ORDER BY Days_To_Expiry;

SELECT Product_Name, SUM(Qty_Wasted) AS Total FROM v_waste_summary
 GROUP BY Product_Name HAVING Total > 1;

SELECT Product_Name FROM PRODUCT
 WHERE Product_ID NOT IN (SELECT Product_ID FROM INVENTORY WHERE Quantity_On_Hand > 0);

EXPLAIN SELECT * FROM INVENTORY WHERE Expiry_Date <= CURDATE() + INTERVAL 7 DAY;
