# CampusShelf

Student marketplace for second-hand books, notes and stationery (Node.js + Express + EJS + MySQL).

## Setup
1. Import the database (creates `campusshelf` with tables and sample data):
   `mysql -u root -p < db/campusshelf.sql`
2. Check the MySQL user/password at the top of `routes/web.js` (default `root` / `root`).
3. `npm install` (only if `node_modules` is missing), then `node server.js`
4. Open http://localhost:3000

Demo logins: `demo@campusshelf.com / demo123` and `buyer@campusshelf.com / buyer123`

## Pages
Login, Register, Home (search + category filter), Product detail, Add product (3 photos),
My listings (edit / delete / mark sold), Favourites, Cart, Notifications, Profile.
