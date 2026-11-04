-- FreshFlow: triggers, procedures, event, views
USE freshflow;
DELIMITER $$

-- ---------------------------------------------------------------
-- Block issuing/wasting-out from an expired batch (ISSUE only;
-- WASTE of an expired batch must stay allowed).
-- ---------------------------------------------------------------
CREATE TRIGGER trg_block_expired_issue
BEFORE INSERT ON STOCK_MOVEMENT
FOR EACH ROW
BEGIN
  DECLARE v_exp DATE;
  DECLARE v_qty INT;
  SELECT Expiry_Date, Quantity_On_Hand INTO v_exp, v_qty
    FROM INVENTORY WHERE Inventory_ID = NEW.Inventory_ID;
  IF NEW.Movement_Type = 'ISSUE' AND v_exp < CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot issue stock from an expired batch';
  END IF;
  IF NEW.Movement_Type IN ('ISSUE','ADJUST_OUT','WASTE') AND NEW.Quantity > v_qty THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity exceeds stock on hand';
  END IF;
END$$

-- ---------------------------------------------------------------
-- Keep Quantity_On_Hand in step with movements; raise LowStock alert
-- ---------------------------------------------------------------
CREATE TRIGGER trg_movement_apply
AFTER INSERT ON STOCK_MOVEMENT
FOR EACH ROW
BEGIN
  DECLARE v_prod INT;
  DECLARE v_total INT;
  DECLARE v_reorder INT;
  DECLARE v_name VARCHAR(120);

  IF NEW.Movement_Type IN ('PURCHASE','ADJUST_IN') THEN
    UPDATE INVENTORY SET Quantity_On_Hand = Quantity_On_Hand + NEW.Quantity
     WHERE Inventory_ID = NEW.Inventory_ID;
  ELSE
    UPDATE INVENTORY SET Quantity_On_Hand = Quantity_On_Hand - NEW.Quantity
     WHERE Inventory_ID = NEW.Inventory_ID;
  END IF;

  SELECT i.Product_ID INTO v_prod FROM INVENTORY i WHERE i.Inventory_ID = NEW.Inventory_ID;
  SELECT SUM(Quantity_On_Hand) INTO v_total FROM INVENTORY WHERE Product_ID = v_prod;
  SELECT Reorder_Level, Product_Name INTO v_reorder, v_name FROM PRODUCT WHERE Product_ID = v_prod;

  IF NEW.Movement_Type IN ('ISSUE','ADJUST_OUT','WASTE')
     AND v_total < v_reorder
     AND NOT EXISTS (SELECT 1 FROM ALERT a JOIN INVENTORY i ON i.Inventory_ID = a.Inventory_ID
                      WHERE i.Product_ID = v_prod AND a.Alert_Type = 'LowStock'
                        AND a.Is_Read = FALSE) THEN
    INSERT INTO ALERT (Inventory_ID, Alert_Type, Message)
    VALUES (NEW.Inventory_ID, 'LowStock',
            CONCAT(v_name, ' is below reorder level (', v_total, ' < ', v_reorder, ')'));
  END IF;
END$$

-- ---------------------------------------------------------------
-- Purchase totals and payment status (Fix 4)
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_refresh_purchase(IN p_id INT)
BEGIN
  DECLARE v_total DECIMAL(12,2);
  DECLARE v_paid  DECIMAL(12,2);
  SELECT COALESCE(SUM(Total_Cost),0) INTO v_total FROM PURCHASE_ITEM WHERE Purchase_ID = p_id;
  SELECT COALESCE(SUM(Amount),0)     INTO v_paid  FROM PAYMENT       WHERE Purchase_ID = p_id;
  UPDATE PURCHASE
     SET Total_Amount = v_total,
         Payment_Status = CASE WHEN v_paid <= 0 THEN 'Unpaid'
                               WHEN v_paid < v_total THEN 'Partial'
                               ELSE 'Paid' END
   WHERE Purchase_ID = p_id;
END$$

CREATE TRIGGER trg_pi_ai AFTER INSERT ON PURCHASE_ITEM
FOR EACH ROW CALL sp_refresh_purchase(NEW.Purchase_ID)$$
CREATE TRIGGER trg_pi_au AFTER UPDATE ON PURCHASE_ITEM
FOR EACH ROW CALL sp_refresh_purchase(NEW.Purchase_ID)$$
CREATE TRIGGER trg_pi_ad AFTER DELETE ON PURCHASE_ITEM
FOR EACH ROW CALL sp_refresh_purchase(OLD.Purchase_ID)$$
CREATE TRIGGER trg_pay_ai AFTER INSERT ON PAYMENT
FOR EACH ROW CALL sp_refresh_purchase(NEW.Purchase_ID)$$

-- ---------------------------------------------------------------
-- Receive a purchase: create batches and PURCHASE movements (transaction)
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_receive_purchase(IN p_purchase INT, IN p_user INT)
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_prod, v_loc, v_qty INT;
  DECLARE v_batch VARCHAR(40);
  DECLARE v_mfg, v_exp DATE;
  DECLARE v_cost DECIMAL(10,2);
  DECLARE v_inv INT;
  DECLARE cur CURSOR FOR
    SELECT Product_ID, Location_ID, Batch_Number, Mfg_Date, Expiry_Date, Quantity, Unit_Cost
      FROM PURCHASE_ITEM WHERE Purchase_ID = p_purchase;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  START TRANSACTION;
  IF (SELECT Received FROM PURCHASE WHERE Purchase_ID = p_purchase FOR UPDATE) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Purchase already received';
  END IF;

  OPEN cur;
  rd: LOOP
    FETCH cur INTO v_prod, v_loc, v_batch, v_mfg, v_exp, v_qty, v_cost;
    IF done = 1 THEN LEAVE rd; END IF;

    INSERT INTO INVENTORY (Product_ID, Location_ID, Purchase_ID, Batch_Number,
                           Mfg_Date, Expiry_Date, Quantity_On_Hand, Unit_Cost)
    VALUES (v_prod, v_loc, p_purchase, v_batch, v_mfg, v_exp, 0, v_cost);
    SET v_inv = LAST_INSERT_ID();

    INSERT INTO STOCK_MOVEMENT (Inventory_ID, User_ID, Movement_Type, Quantity, Note)
    VALUES (v_inv, p_user, 'PURCHASE', v_qty, CONCAT('Purchase #', p_purchase));
  END LOOP;
  CLOSE cur;

  UPDATE PURCHASE SET Received = TRUE WHERE Purchase_ID = p_purchase;
  COMMIT;
END$$

-- ---------------------------------------------------------------
-- FEFO issue: earliest non-expired batch first, one movement per batch
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_issue_stock(IN p_product INT, IN p_location INT,
                                IN p_qty INT, IN p_user INT)
BEGIN
  DECLARE v_remaining INT DEFAULT p_qty;
  DECLARE v_available INT;
  DECLARE v_inv, v_take, v_onhand INT;
  DECLARE done INT DEFAULT 0;
  DECLARE cur CURSOR FOR
    SELECT Inventory_ID, Quantity_On_Hand FROM INVENTORY
     WHERE Product_ID = p_product AND Location_ID = p_location
       AND Quantity_On_Hand > 0 AND Expiry_Date >= CURDATE()
     ORDER BY Expiry_Date ASC, Inventory_ID ASC
     FOR UPDATE;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  IF p_qty <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be positive';
  END IF;

  START TRANSACTION;
  SELECT COALESCE(SUM(Quantity_On_Hand),0) INTO v_available FROM INVENTORY
   WHERE Product_ID = p_product AND Location_ID = p_location AND Expiry_Date >= CURDATE();
  IF v_available < p_qty THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient unexpired stock';
  END IF;

  OPEN cur;
  il: LOOP
    FETCH cur INTO v_inv, v_onhand;
    IF done = 1 OR v_remaining <= 0 THEN LEAVE il; END IF;
    SET v_take = LEAST(v_onhand, v_remaining);
    INSERT INTO STOCK_MOVEMENT (Inventory_ID, User_ID, Movement_Type, Quantity, Note)
    VALUES (v_inv, p_user, 'ISSUE', v_take, 'FEFO issue');
    SET v_remaining = v_remaining - v_take;
  END LOOP;
  CLOSE cur;
  COMMIT;
END$$

-- ---------------------------------------------------------------
-- Waste: movement + waste row + reduced quantity, all or nothing
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_record_waste(IN p_inv INT, IN p_qty INT, IN p_reason VARCHAR(20),
                                 IN p_method VARCHAR(60), IN p_remarks VARCHAR(255),
                                 IN p_user INT)
BEGIN
  DECLARE v_mov INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  INSERT INTO STOCK_MOVEMENT (Inventory_ID, User_ID, Movement_Type, Quantity, Note)
  VALUES (p_inv, p_user, 'WASTE', p_qty, p_reason);
  SET v_mov = LAST_INSERT_ID();
  INSERT INTO WASTE (Movement_ID, Inventory_ID, Reason, Disposal_Method, Remarks)
  VALUES (v_mov, p_inv, p_reason, p_method, p_remarks);
  COMMIT;
END$$

-- ---------------------------------------------------------------
-- Adjustment with mandatory note
-- ---------------------------------------------------------------
CREATE PROCEDURE sp_adjust_stock(IN p_inv INT, IN p_qty INT, IN p_direction VARCHAR(3),
                                 IN p_note VARCHAR(255), IN p_user INT)
BEGIN
  IF p_note IS NULL OR CHAR_LENGTH(TRIM(p_note)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A note is required for adjustments';
  END IF;
  INSERT INTO STOCK_MOVEMENT (Inventory_ID, User_ID, Movement_Type, Quantity, Note)
  VALUES (p_inv, p_user,
          IF(p_direction = 'IN', 'ADJUST_IN', 'ADJUST_OUT'), p_qty, p_note);
END$$

-- ---------------------------------------------------------------
-- Daily expiry alerts (needs: SET GLOBAL event_scheduler = ON)
-- ---------------------------------------------------------------
CREATE EVENT ev_daily_expiry_alerts
ON SCHEDULE EVERY 1 DAY STARTS (CURRENT_DATE + INTERVAL 1 DAY + INTERVAL 1 HOUR)
DO
  INSERT INTO ALERT (Inventory_ID, Alert_Type, Message)
  SELECT i.Inventory_ID, 'Expiry',
         CONCAT(p.Product_Name, ' batch ', i.Batch_Number, ' expires on ', i.Expiry_Date)
    FROM INVENTORY i JOIN PRODUCT p ON p.Product_ID = i.Product_ID
   WHERE i.Quantity_On_Hand > 0
     AND i.Expiry_Date BETWEEN CURDATE() AND CURDATE() + INTERVAL 7 DAY
     AND NOT EXISTS (SELECT 1 FROM ALERT a
                      WHERE a.Inventory_ID = i.Inventory_ID AND a.Alert_Type = 'Expiry'
                        AND DATE(a.Created_At) = CURDATE())$$

DELIMITER ;

-- ---------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------
CREATE VIEW v_stock_by_location AS
SELECT i.Inventory_ID, p.Product_ID, p.Product_Name, l.Location_ID, l.Location_Name,
       i.Batch_Number, i.Expiry_Date, i.Quantity_On_Hand,
       DATEDIFF(i.Expiry_Date, CURDATE()) AS Days_To_Expiry
  FROM INVENTORY i
  JOIN PRODUCT p  ON p.Product_ID  = i.Product_ID
  JOIN LOCATION l ON l.Location_ID = i.Location_ID;

CREATE VIEW v_expiring_soon AS
SELECT v.*, (v.Quantity_On_Hand * i.Unit_Cost) AS Value_At_Risk,
       CASE WHEN v.Days_To_Expiry <= 3  THEN '3'
            WHEN v.Days_To_Expiry <= 7  THEN '7'
            ELSE '15' END AS Risk_Bucket
  FROM v_stock_by_location v
  JOIN INVENTORY i ON i.Inventory_ID = v.Inventory_ID
 WHERE v.Quantity_On_Hand > 0 AND v.Days_To_Expiry BETWEEN 0 AND 15;

CREATE VIEW v_waste_summary AS
SELECT p.Product_ID, p.Product_Name, s.Supplier_ID, s.Supplier_Name,
       w.Reason, l.Location_Name,
       DATE_FORMAT(m.Moved_At, '%Y-%m') AS Month,
       SUM(m.Quantity) AS Qty_Wasted,
       SUM(m.Quantity * i.Unit_Cost) AS Cost_Wasted
  FROM WASTE w
  JOIN STOCK_MOVEMENT m ON m.Movement_ID  = w.Movement_ID
  JOIN INVENTORY i      ON i.Inventory_ID = w.Inventory_ID
  JOIN PRODUCT p        ON p.Product_ID   = i.Product_ID
  JOIN LOCATION l       ON l.Location_ID  = i.Location_ID
  LEFT JOIN PURCHASE pu ON pu.Purchase_ID = i.Purchase_ID
  LEFT JOIN SUPPLIER s  ON s.Supplier_ID  = pu.Supplier_ID
 GROUP BY p.Product_ID, p.Product_Name, s.Supplier_ID, s.Supplier_Name,
          w.Reason, l.Location_Name, DATE_FORMAT(m.Moved_At, '%Y-%m');
