-- CampusShelf database (MySQL 8 / MariaDB 10.4+)
-- Import:  mysql -u root -p < db/campusshelf.sql
-- Demo logins:  demo@campusshelf.com / demo123   and   buyer@campusshelf.com / buyer123

CREATE DATABASE IF NOT EXISTS shelf CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE shelf;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS cart;
DROP TABLE IF EXISTS favourites;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  uid        INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  contact    VARCHAR(30)  NOT NULL,
  address    TEXT         NOT NULL,
  email      VARCHAR(150) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,          -- scrypt "salt:hash"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE products (
  p_id        INT AUTO_INCREMENT PRIMARY KEY,
  uid         INT NOT NULL,                  -- owner / seller
  p_category  VARCHAR(30)  NOT NULL,
  p_name      VARCHAR(120) NOT NULL,
  p_price     INT          NOT NULL,
  p_condition VARCHAR(30)  NOT NULL DEFAULT 'Used',
  p_desc      TEXT,
  p_img1      VARCHAR(255) NOT NULL,
  p_img2      VARCHAR(255) NOT NULL,
  p_img3      VARCHAR(255) NOT NULL,
  seller_name VARCHAR(100),
  contact     VARCHAR(30),
  address     TEXT,
  status      ENUM('available','sold') NOT NULL DEFAULT 'available',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_status_cat (status, p_category),
  CONSTRAINT fk_prod_user FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE favourites (
  fav_id     INT AUTO_INCREMENT PRIMARY KEY,
  uid        INT NOT NULL,
  p_id       INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fav (uid, p_id),
  CONSTRAINT fk_fav_user FOREIGN KEY (uid)  REFERENCES users(uid)     ON DELETE CASCADE,
  CONSTRAINT fk_fav_prod FOREIGN KEY (p_id) REFERENCES products(p_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cart (
  cart_id    INT AUTO_INCREMENT PRIMARY KEY,
  uid        INT NOT NULL,
  p_id       INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cart (uid, p_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (uid)  REFERENCES users(uid)     ON DELETE CASCADE,
  CONSTRAINT fk_cart_prod FOREIGN KEY (p_id) REFERENCES products(p_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
  n_id       INT AUTO_INCREMENT PRIMARY KEY,
  uid        INT NOT NULL,
  title      VARCHAR(150) NOT NULL,
  message    VARCHAR(400) NOT NULL,
  icon       VARCHAR(10) DEFAULT '✦',
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_read (uid, is_read),
  CONSTRAINT fk_note_user FOREIGN KEY (uid) REFERENCES users(uid) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------- Sample data ----------
INSERT INTO users (uid,name,contact,address,email,password) VALUES
(1,'Demo Seller','9876543210','Main campus, Hostel Block A','demo@campusshelf.com',
 '29ebc6f12ecb0ca5e31213db96d9a5fb:6bf4eefb75cb2725db928ea738e416a7ae2901e7ac1cf44a258c060686323877cb94950f69e7421777ada8a9a353e686efcdadbdad7b3d515e66f6ed26ad9e96'),
(2,'Demo Buyer','9123456780','Main campus, Library gate','buyer@campusshelf.com',
 'cbbfe0969ed56988e7017c021301c1c8:867c8d42353bc6fec297a3374f105269e9678dbbc88138c3d725bdb444244bb5533ae404da9d35f4fcc4447d5196eb1c06de3d3b6b4d2e730d797108bfd2c0d9');

INSERT INTO products (uid,p_category,p_name,p_price,p_condition,p_desc,p_img1,p_img2,p_img3,seller_name,contact,address,status) VALUES
(1,'Books','Engineering Mathematics II',180,'Good','Well-kept reference book with a few highlighted sections. Great for exam revision.','1792138423449_1_IMG_3118.JPG','1792138423449_2_IMG_3119.JPG','1792138423449_3_IMG_3117.JPG','Demo Seller','9876543210','Main campus, Hostel Block A','available'),
(1,'Notes','First Year Physics Notes',90,'Like new','Organised handwritten notes covering the main topics and solved examples.','1792138545679_1_IMG_3117.JPG','1792138545679_2_IMG_3118.JPG','1792138545679_3_IMG_3119.JPG','Demo Seller','9876543210','Main campus, Hostel Block A','available'),
(1,'Stationery','Stationery Starter Set',120,'Good','Pens, highlighters, ruler and geometry tools. Selling as one set.','1792138423449_2_IMG_3119.JPG','1792138423449_3_IMG_3117.JPG','1792138423449_1_IMG_3118.JPG','Demo Seller','9876543210','Main campus, Hostel Block A','available'),
(1,'Books','Data Structures Textbook',250,'Used','Useful for understanding core data structures. Minor wear on the cover.','1792138545679_2_IMG_3118.JPG','1792138545679_3_IMG_3119.JPG','1792138545679_1_IMG_3117.JPG','Demo Seller','9876543210','Main campus, Hostel Block A','sold'),
(2,'Notes','DBMS Quick Revision Notes',65,'Good','Concise notes for SQL, normalisation, keys and transactions.','1792138423449_3_IMG_3117.JPG','1792138423449_1_IMG_3118.JPG','1792138423449_2_IMG_3119.JPG','Demo Buyer','9123456780','Main campus, Library gate','available'),
(2,'Other','Scientific Calculator',300,'Like new','Working scientific calculator. Ideal for engineering mathematics.','1792138545679_3_IMG_3119.JPG','1792138545679_1_IMG_3117.JPG','1792138545679_2_IMG_3118.JPG','Demo Buyer','9123456780','Main campus, Library gate','available'),
(2,'Stationery','Pastel Highlighter Pack',75,'Like new','Five pastel highlighters, all working well.','1792138423449_1_IMG_3118.JPG','1792138423449_3_IMG_3117.JPG','1792138423449_2_IMG_3119.JPG','Demo Buyer','9123456780','Main campus, Library gate','available'),
(2,'Books','Operating Systems Book',160,'Used','Second-hand book for OS fundamentals and practice questions.','1792138545679_1_IMG_3117.JPG','1792138545679_3_IMG_3119.JPG','1792138545679_2_IMG_3118.JPG','Demo Buyer','9123456780','Main campus, Library gate','available');

INSERT INTO favourites (uid,p_id) VALUES (2,1),(2,2),(1,5);
INSERT INTO cart (uid,p_id) VALUES (2,3);
INSERT INTO notifications (uid,title,message,icon,is_read) VALUES
(1,'Welcome to CampusShelf!','Browse pre-loved study essentials or list something you no longer need.','✦',0),
(1,'Your listing was saved','Demo Buyer saved "Engineering Mathematics II" to favourites.','♥',0),
(2,'Welcome to CampusShelf!','Browse pre-loved study essentials or list something you no longer need.','✦',0);
