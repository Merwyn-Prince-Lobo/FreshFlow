-- FreshFlow: core schema (MySQL 8+)
-- Includes schema fixes 1-7 from the completion plan.
DROP DATABASE IF EXISTS freshflow;
CREATE DATABASE freshflow CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE freshflow;

CREATE TABLE ROLE (
  Role_ID    INT AUTO_INCREMENT PRIMARY KEY,
  Role_Name  VARCHAR(20) NOT NULL UNIQUE
);

-- Named APP_USER because USER is a MySQL keyword
CREATE TABLE APP_USER (
  User_ID        INT AUTO_INCREMENT PRIMARY KEY,
  Name           VARCHAR(100) NOT NULL,
  Email          VARCHAR(150) NOT NULL UNIQUE,
  Password_Hash  VARCHAR(100) NOT NULL,
  Role_ID        INT NOT NULL,
  Status         ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  Created_At     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (Role_ID) REFERENCES ROLE(Role_ID)
);

CREATE TABLE SUPPLIER (
  Supplier_ID    INT AUTO_INCREMENT PRIMARY KEY,
  Supplier_Name  VARCHAR(120) NOT NULL,
  Contact_Person VARCHAR(100),
  Phone          VARCHAR(20),
  Email          VARCHAR(150),
  Address        VARCHAR(255)
);

CREATE TABLE PRODUCT (
  Product_ID       INT AUTO_INCREMENT PRIMARY KEY,
  Product_Name     VARCHAR(120) NOT NULL,
  Description      VARCHAR(255),
  Category         VARCHAR(60),
  Unit_Of_Measure  VARCHAR(20) NOT NULL DEFAULT 'unit',
  Shelf_Life_Days  INT NOT NULL CHECK (Shelf_Life_Days > 0),
  Reorder_Level    INT NOT NULL DEFAULT 0 CHECK (Reorder_Level >= 0),
  Selling_Price    DECIMAL(10,2) CHECK (Selling_Price >= 0),
  FULLTEXT KEY ft_product (Product_Name, Description)
);

-- Fix 5: many suppliers per product
CREATE TABLE PRODUCT_SUPPLIER (
  Product_ID  INT NOT NULL,
  Supplier_ID INT NOT NULL,
  PRIMARY KEY (Product_ID, Supplier_ID),
  FOREIGN KEY (Product_ID)  REFERENCES PRODUCT(Product_ID),
  FOREIGN KEY (Supplier_ID) REFERENCES SUPPLIER(Supplier_ID)
);

CREATE TABLE LOCATION (
  Location_ID    INT AUTO_INCREMENT PRIMARY KEY,
  Location_Name  VARCHAR(80) NOT NULL UNIQUE,
  Location_Type  ENUM('Warehouse','ColdRoom','Shelf') NOT NULL,
  Min_Temp_C     DECIMAL(4,1) NOT NULL DEFAULT 0,
  Max_Temp_C     DECIMAL(4,1) NOT NULL DEFAULT 30,
  CHECK (Min_Temp_C <= Max_Temp_C)
);

CREATE TABLE PURCHASE (
  Purchase_ID     INT AUTO_INCREMENT PRIMARY KEY,
  Supplier_ID     INT NOT NULL,
  User_ID         INT NOT NULL,
  Purchase_Date   DATE NOT NULL,
  -- Fix 4: kept up to date by triggers
  Total_Amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
  Payment_Status  ENUM('Unpaid','Partial','Paid') NOT NULL DEFAULT 'Unpaid',
  Received        BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (Supplier_ID) REFERENCES SUPPLIER(Supplier_ID),
  FOREIGN KEY (User_ID)     REFERENCES APP_USER(User_ID)
);

CREATE TABLE PURCHASE_ITEM (
  Item_ID       INT AUTO_INCREMENT PRIMARY KEY,
  Purchase_ID   INT NOT NULL,
  Product_ID    INT NOT NULL,
  Location_ID   INT NOT NULL,
  Batch_Number  VARCHAR(40) NOT NULL,
  Mfg_Date      DATE NOT NULL,
  Expiry_Date   DATE NOT NULL,
  Quantity      INT NOT NULL CHECK (Quantity > 0),
  Unit_Cost     DECIMAL(10,2) NOT NULL CHECK (Unit_Cost >= 0),
  Total_Cost    DECIMAL(12,2) AS (Quantity * Unit_Cost) STORED,   -- Fix 4
  CHECK (Expiry_Date >= Mfg_Date),
  FOREIGN KEY (Purchase_ID) REFERENCES PURCHASE(Purchase_ID) ON DELETE CASCADE,
  FOREIGN KEY (Product_ID)  REFERENCES PRODUCT(Product_ID),
  FOREIGN KEY (Location_ID) REFERENCES LOCATION(Location_ID)
);

CREATE TABLE PAYMENT (
  Payment_ID   INT AUTO_INCREMENT PRIMARY KEY,
  Purchase_ID  INT NOT NULL,
  Amount       DECIMAL(12,2) NOT NULL CHECK (Amount > 0),
  Paid_On      DATE NOT NULL,
  Method       ENUM('Cash','UPI','Card','BankTransfer') NOT NULL DEFAULT 'Cash',
  FOREIGN KEY (Purchase_ID) REFERENCES PURCHASE(Purchase_ID)
);

CREATE TABLE INVENTORY (
  Inventory_ID      INT AUTO_INCREMENT PRIMARY KEY,
  Product_ID        INT NOT NULL,
  Location_ID       INT NOT NULL,
  Purchase_ID       INT NULL,                        -- Fix 1 (the ALTER TABLE demo, folded in here)
  Batch_Number      VARCHAR(40) NOT NULL,
  Mfg_Date          DATE NOT NULL,
  Expiry_Date       DATE NOT NULL,
  Quantity_On_Hand  INT NOT NULL DEFAULT 0 CHECK (Quantity_On_Hand >= 0),
  Unit_Cost         DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT chk_inv_dates CHECK (Expiry_Date >= Mfg_Date),                          -- Fix 6
  CONSTRAINT uq_batch UNIQUE (Product_ID, Location_ID, Batch_Number),                -- Fix 6
  FOREIGN KEY (Product_ID)  REFERENCES PRODUCT(Product_ID),
  FOREIGN KEY (Location_ID) REFERENCES LOCATION(Location_ID),
  FOREIGN KEY (Purchase_ID) REFERENCES PURCHASE(Purchase_ID)
);
CREATE INDEX idx_inv_expiry  ON INVENTORY (Expiry_Date);
CREATE INDEX idx_inv_prodloc ON INVENTORY (Product_ID, Location_ID);

CREATE TABLE STOCK_MOVEMENT (
  Movement_ID    INT AUTO_INCREMENT PRIMARY KEY,
  Inventory_ID   INT NOT NULL,
  User_ID        INT NOT NULL,                       -- Fix 2
  Movement_Type  ENUM('PURCHASE','ISSUE','ADJUST_IN','ADJUST_OUT','WASTE') NOT NULL,  -- Fix 3
  Quantity       INT NOT NULL CHECK (Quantity > 0),
  Note           VARCHAR(255),
  Moved_At       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (Inventory_ID) REFERENCES INVENTORY(Inventory_ID),
  FOREIGN KEY (User_ID)      REFERENCES APP_USER(User_ID)
);
CREATE INDEX idx_mov_inv ON STOCK_MOVEMENT (Inventory_ID, Moved_At);

CREATE TABLE WASTE (
  Waste_ID         INT AUTO_INCREMENT PRIMARY KEY,
  Movement_ID      INT NOT NULL UNIQUE,              -- Fix 2
  Inventory_ID     INT NOT NULL,
  Reason           VARCHAR(20) NOT NULL,
  CONSTRAINT chk_waste_reason CHECK (Reason IN ('Expired','Damaged','Spoiled','Other')),
  Disposal_Method  VARCHAR(60) NOT NULL,
  Remarks          VARCHAR(255),
  FOREIGN KEY (Movement_ID)  REFERENCES STOCK_MOVEMENT(Movement_ID),
  FOREIGN KEY (Inventory_ID) REFERENCES INVENTORY(Inventory_ID),
  FULLTEXT KEY ft_waste (Reason, Remarks)
);

-- Current alert state lives here; its history lives in MongoDB alert_events
CREATE TABLE ALERT (
  Alert_ID      INT AUTO_INCREMENT PRIMARY KEY,
  Inventory_ID  INT NOT NULL,
  Alert_Type    ENUM('Expiry','LowStock') NOT NULL,
  Message       VARCHAR(255) NOT NULL,
  Is_Read       BOOLEAN NOT NULL DEFAULT FALSE,
  Created_At    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (Inventory_ID) REFERENCES INVENTORY(Inventory_ID)
);
CREATE INDEX idx_alert_unread ON ALERT (Is_Read, Created_At);

CREATE TABLE REPORT (
  Report_ID     INT AUTO_INCREMENT PRIMARY KEY,
  User_ID       INT NOT NULL,
  Report_Type   ENUM('Stock','Purchase','Waste') NOT NULL,
  From_Date     DATE NOT NULL,
  To_Date       DATE NOT NULL,
  Generated_At  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (User_ID) REFERENCES APP_USER(User_ID)
);

INSERT INTO ROLE (Role_Name) VALUES ('Admin'), ('Staff');   -- Fix 7
