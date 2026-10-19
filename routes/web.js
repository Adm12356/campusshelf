var express = require('express');
var router = express.Router();
var mysql = require('mysql2');
var util = require('util');
var session = require('express-session');
var fileupload = require('express-fileupload');
var path = require('path');
var crypto = require('crypto');
var fs = require('fs/promises');

router.use(express.static(path.join(__dirname, '../public')));

var conn=mysql.createConnection({
    host : 'b87s755efw6tk028qvi3-mysql.services.clever-cloud.com',
    user : 'uq0ukp2bdzy1jmpk',
    password : 'pRylLPBVhgvTBrXeKBrM',
    database : 'b87s755efw6tk028qvi3'
})
var exe = util.promisify(conn.query).bind(conn);

router.use(express.urlencoded({ extended: true }));
router.use(session({
    secret: 'CAPMUSSHELF',
    resave: false,
    saveUninitialized: true
}));
router.use(fileupload({ limits: { fileSize: 15 * 1024 * 1024 } }));

const UPLOAD_DIR = path.join(__dirname, '../public/images');
const CATEGORIES = ['Books', 'Notes', 'Stationery', 'Other'];

/* ---------------- helpers ---------------- */
function hashPassword(pw) {
    const salt = crypto.randomBytes(16).toString('hex');
    return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function verifyPassword(pw, stored) {
    if (!stored) return false;
    if (!stored.includes(':')) return pw === stored;          // legacy plain-text rows
    const [salt, hash] = stored.split(':');
    const test = crypto.scryptSync(pw, salt, 64);
    const real = Buffer.from(hash, 'hex');
    return real.length === test.length && crypto.timingSafeEqual(real, test);
}
function ago(date) {
    const s = Math.max(1, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' hr ago';
    if (s < 604800) return Math.floor(s / 86400) + ' day(s) ago';
    return new Date(date).toLocaleDateString('en-IN');
}
function money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN'); }
async function notify(uid, title, message, icon) {
    try {
        await exe('INSERT INTO notifications (uid,title,message,icon) VALUES (?,?,?,?)', [uid, title, message, icon || '✦']);
    } catch (e) { console.error('notify failed:', e.message); }
}
async function saveImage(file, slot) {
    if (!file || Array.isArray(file) || !file.mimetype.startsWith('image/')) return null;
    const safe = path.basename(file.name).replace(/[^\w.\-]/g, '_');
    const name = `${Date.now()}_${slot}_${safe}`;
    await file.mv(path.join(UPLOAD_DIR, name));
    return name;
}
async function removeImages(names) {
    for (const n of names) {
        if (n) await fs.unlink(path.join(UPLOAD_DIR, path.basename(n))).catch(() => {});
    }
}

function logincheck(req, res, next) {
    if (req.session.uid) next();
    else res.redirect('/');
}

// values every template can use
router.use(async (req, res, next) => {
    res.locals.name = req.session.name;
    res.locals.active = '';
    res.locals.q = '';
    res.locals.category = 'All';
    res.locals.cartCount = 0;
    res.locals.unread = 0;
    res.locals.ago = ago;
    res.locals.money = money;
    if (req.session.uid) {
        try {
            const c = await exe('SELECT COUNT(*) AS n FROM cart WHERE uid=?', [req.session.uid]);
            const n = await exe('SELECT COUNT(*) AS n FROM notifications WHERE uid=? AND is_read=0', [req.session.uid]);
            res.locals.cartCount = c[0].n;
            res.locals.unread = n[0].n;
        } catch (e) { console.error(e.message); }
    }
    next();
});

/* ---------------- auth ---------------- */
router.get('/', (req, res) => {
    if (req.session.uid) return res.redirect('/home');
    res.render('web/login.ejs', { err: req.query.err });
});

router.post('/login_check', async (req, res) => {
    var { email, password } = req.body;
    var data = await exe('SELECT * FROM users WHERE email=?', [email]);
    if (data[0] && verifyPassword(password, data[0].password)) {
        if (!data[0].password.includes(':')) {   // upgrade legacy plain-text password
            await exe('UPDATE users SET password=? WHERE uid=?', [hashPassword(password), data[0].uid]);
        }
        req.session.uid = data[0].uid;
        req.session.name = data[0].name;
        res.redirect('/home');
    } else {
        res.redirect('/?err=1');
    }
});

router.get('/register', (req, res) => {
    res.render('web/register.ejs', { err: req.query.err });
});

router.post('/register_save', async (req, res) => {
    var { name, contact, address, email, password } = req.body;
    var exists = await exe('SELECT uid FROM users WHERE email=?', [email]);
    if (exists.length) return res.redirect('/register?err=exists');
    var r = await exe('INSERT INTO users (name,contact,address,email,password) VALUES (?,?,?,?,?)',
        [name, contact, address, email, hashPassword(password)]);
    await notify(r.insertId, 'Welcome to CampusShelf!', 'Browse pre-loved study essentials or list something you no longer need.');
    res.redirect('/');
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

/* ---------------- home ---------------- */
router.get('/home', logincheck, async (req, res) => {
    const q = (req.query.q || '').trim();
    const category = CATEGORIES.includes(req.query.category) ? req.query.category : 'All';
    const like = '%' + q + '%';
    const products = await exe(
        `SELECT p.*,
                (f.fav_id IS NOT NULL) AS is_fav,
                (c.cart_id IS NOT NULL) AS in_cart
           FROM products p
      LEFT JOIN favourites f ON f.p_id=p.p_id AND f.uid=?
      LEFT JOIN cart c       ON c.p_id=p.p_id AND c.uid=?
          WHERE p.status='available'
            AND (?='All' OR p.p_category=?)
            AND (p.p_name LIKE ? OR p.p_desc LIKE ? OR p.p_category LIKE ?)
       ORDER BY p.created_at DESC, p.p_id DESC`,
        [req.session.uid, req.session.uid, category, category, like, like, like]);
    res.render('web/index.ejs', { products, q, category, active: 'home', uid: req.session.uid });
});

/* ---------------- product detail ---------------- */
router.get('/product/:id', logincheck, async (req, res) => {
    const rows = await exe(
        `SELECT p.*,
                (f.fav_id IS NOT NULL) AS is_fav,
                (c.cart_id IS NOT NULL) AS in_cart
           FROM products p
      LEFT JOIN favourites f ON f.p_id=p.p_id AND f.uid=?
      LEFT JOIN cart c       ON c.p_id=p.p_id AND c.uid=?
          WHERE p.p_id=?`, [req.session.uid, req.session.uid, req.params.id]);
    if (!rows.length) return res.status(404).send('Product not found');
    res.render('web/product_detail.ejs', { p: rows[0], uid: req.session.uid });
});

/* ---------------- favourites ---------------- */
router.get('/favourites', logincheck, async (req, res) => {
    const products = await exe(
        `SELECT p.*, 1 AS is_fav, (c.cart_id IS NOT NULL) AS in_cart
           FROM favourites f
           JOIN products p ON p.p_id=f.p_id
      LEFT JOIN cart c ON c.p_id=p.p_id AND c.uid=?
          WHERE f.uid=?
       ORDER BY f.created_at DESC`, [req.session.uid, req.session.uid]);
    res.render('web/favourites.ejs', { products, active: 'favourites', uid: req.session.uid });
});

router.post('/favourite/:id', logincheck, async (req, res) => {
    const pid = Number(req.params.id);
    const prod = await exe('SELECT p_id,uid,p_name FROM products WHERE p_id=?', [pid]);
    if (!prod.length) return res.status(404).json({ error: 'Not found' });
    const existing = await exe('SELECT fav_id FROM favourites WHERE uid=? AND p_id=?', [req.session.uid, pid]);
    let saved;
    if (existing.length) {
        await exe('DELETE FROM favourites WHERE fav_id=?', [existing[0].fav_id]);
        saved = false;
    } else {
        await exe('INSERT INTO favourites (uid,p_id) VALUES (?,?)', [req.session.uid, pid]);
        saved = true;
        if (prod[0].uid !== req.session.uid) {
            await notify(prod[0].uid, 'Someone saved your listing',
                `${req.session.name} saved "${prod[0].p_name}" to favourites.`, '♥');
        }
    }
    res.json({ saved });
});

/* ---------------- cart ---------------- */
router.get('/cart', logincheck, async (req, res) => {
    const items = await exe(
        `SELECT p.*, c.cart_id FROM cart c
           JOIN products p ON p.p_id=c.p_id
          WHERE c.uid=? ORDER BY c.created_at DESC`, [req.session.uid]);
    const total = items.filter(i => i.status === 'available').reduce((s, i) => s + Number(i.p_price), 0);
    res.render('web/cart.ejs', { items, total, active: 'cart' });
});

router.post('/cart/add/:id', logincheck, async (req, res) => {
    const pid = Number(req.params.id);
    const prod = await exe('SELECT p_id,uid,p_name,status FROM products WHERE p_id=?', [pid]);
    if (!prod.length) return res.status(404).json({ error: 'Product not found' });
    if (prod[0].uid === req.session.uid) return res.json({ ok: false, message: "You can't add your own listing" });
    if (prod[0].status === 'sold') return res.json({ ok: false, message: 'This item is already sold' });
    const existing = await exe('SELECT cart_id FROM cart WHERE uid=? AND p_id=?', [req.session.uid, pid]);
    if (existing.length) return res.json({ ok: false, message: 'Already in your cart' });
    await exe('INSERT INTO cart (uid,p_id) VALUES (?,?)', [req.session.uid, pid]);
    await notify(prod[0].uid, 'Interest in your listing',
        `${req.session.name} added "${prod[0].p_name}" to their cart.`, '🛒');
    const c = await exe('SELECT COUNT(*) AS n FROM cart WHERE uid=?', [req.session.uid]);
    res.json({ ok: true, message: 'Added to cart', count: c[0].n });
});

router.post('/cart/remove/:id', logincheck, async (req, res) => {
    await exe('DELETE FROM cart WHERE uid=? AND p_id=?', [req.session.uid, req.params.id]);
    res.redirect('/cart');
});

/* ---------------- profile ---------------- */
router.get('/profile', logincheck, async (req, res) => {
    const users = await exe('SELECT * FROM users WHERE uid=?', [req.session.uid]);
    res.render('web/profile.ejs', { user: users[0], active: 'profile', saved: req.query.saved });
});

router.post('/profile_save', logincheck, async (req, res) => {
    var { name, contact, address } = req.body;
    await exe('UPDATE users SET name=?,contact=?,address=? WHERE uid=?', [name, contact, address, req.session.uid]);
    req.session.name = name;
    res.redirect('/profile?saved=1');
});

/* ---------------- add / edit / delete product ---------------- */
router.get('/add_product', logincheck, async (req, res) => {
    const users = await exe('SELECT * FROM users WHERE uid=?', [req.session.uid]);
    res.render('web/add_product.ejs', { user: users[0], product: null, active: 'add-product', err: req.query.err });
});

router.post('/product_save', logincheck, async (req, res) => {
    try {
        const { p_category, p_name, p_price, p_condition, p_desc, address } = req.body;
        if (!CATEGORIES.includes(p_category)) return res.redirect('/add_product?err=category');

        const files = [req.files && req.files.p_img1, req.files && req.files.p_img2, req.files && req.files.p_img3];
        if (files.some(f => !f)) return res.redirect('/add_product?err=images');

        const seller = await exe('SELECT name, contact FROM users WHERE uid=?', [req.session.uid]);
        if (!seller.length) return res.status(401).send('Seller account not found.');

        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        const names = [];
        for (let i = 0; i < 3; i++) names.push(await saveImage(files[i], i + 1));
        if (names.some(n => !n)) {
            await removeImages(names);
            return res.redirect('/add_product?err=images');
        }

        await exe(
            `INSERT INTO products (uid,p_category,p_name,p_price,p_condition,p_desc,
                                   p_img1,p_img2,p_img3,seller_name,contact,address)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [req.session.uid, p_category, p_name, p_price, p_condition, p_desc,
             names[0], names[1], names[2], seller[0].name, seller[0].contact, address]);
        await notify(req.session.uid, 'Listing published', `"${p_name}" is now live on CampusShelf.`, '✔');
        res.redirect('/my_listings');
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

router.get('/edit_product/:id', logincheck, async (req, res) => {
    const rows = await exe('SELECT * FROM products WHERE p_id=? AND uid=?', [req.params.id, req.session.uid]);
    if (!rows.length) return res.status(404).send('Listing not found');
    const users = await exe('SELECT * FROM users WHERE uid=?', [req.session.uid]);
    res.render('web/add_product.ejs', { user: users[0], product: rows[0], active: 'my-listings', err: req.query.err });
});

router.post('/product_update/:id', logincheck, async (req, res) => {
    try {
        const rows = await exe('SELECT * FROM products WHERE p_id=? AND uid=?', [req.params.id, req.session.uid]);
        if (!rows.length) return res.status(404).send('Listing not found');
        const old = rows[0];
        const { p_category, p_name, p_price, p_condition, p_desc, address } = req.body;
        if (!CATEGORIES.includes(p_category)) return res.redirect('/edit_product/' + old.p_id + '?err=category');

        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        const cols = ['p_img1', 'p_img2', 'p_img3'];
        const imgs = [old.p_img1, old.p_img2, old.p_img3];
        const replaced = [];
        for (let i = 0; i < 3; i++) {
            const f = req.files && req.files[cols[i]];
            if (f && !Array.isArray(f) && f.size > 0) {
                const n = await saveImage(f, i + 1);
                if (n) { replaced.push(imgs[i]); imgs[i] = n; }
            }
        }
        await exe(
            `UPDATE products SET p_category=?,p_name=?,p_price=?,p_condition=?,p_desc=?,
                    p_img1=?,p_img2=?,p_img3=?,address=? WHERE p_id=? AND uid=?`,
            [p_category, p_name, p_price, p_condition, p_desc, imgs[0], imgs[1], imgs[2], address, old.p_id, req.session.uid]);
        await removeImages(replaced);
        res.redirect('/my_listings');
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

router.post('/product_delete/:id', logincheck, async (req, res) => {
    const rows = await exe('SELECT * FROM products WHERE p_id=? AND uid=?', [req.params.id, req.session.uid]);
    if (rows.length) {
        await exe('DELETE FROM products WHERE p_id=? AND uid=?', [req.params.id, req.session.uid]);
        await removeImages([rows[0].p_img1, rows[0].p_img2, rows[0].p_img3]);
    }
    res.redirect('/my_listings');
});

router.post('/product_status/:id', logincheck, async (req, res) => {
    const rows = await exe('SELECT p_id,p_name,status FROM products WHERE p_id=? AND uid=?', [req.params.id, req.session.uid]);
    if (rows.length) {
        const next = rows[0].status === 'sold' ? 'available' : 'sold';
        await exe('UPDATE products SET status=? WHERE p_id=?', [next, rows[0].p_id]);
        await notify(req.session.uid, next === 'sold' ? 'Marked as sold' : 'Listing is live again',
            `"${rows[0].p_name}" is now ${next}.`, next === 'sold' ? '✔' : '↺');
    }
    res.redirect('/my_listings');
});

/* ---------------- my listings ---------------- */
router.get('/my_listings', logincheck, async (req, res) => {
    const products = await exe('SELECT * FROM products WHERE uid=? ORDER BY created_at DESC, p_id DESC', [req.session.uid]);
    res.render('web/my_listings.ejs', { products, active: 'my-listings' });
});

/* ---------------- notifications ---------------- */
router.get('/notifications', logincheck, async (req, res) => {
    const notes = await exe('SELECT * FROM notifications WHERE uid=? ORDER BY created_at DESC, n_id DESC', [req.session.uid]);
    res.render('web/notifications.ejs', { notes, active: 'notifications', unread: notes.filter(n => !n.is_read).length });
    await exe('UPDATE notifications SET is_read=1 WHERE uid=?', [req.session.uid]);
});

router.post('/notifications/clear', logincheck, async (req, res) => {
    await exe('DELETE FROM notifications WHERE uid=?', [req.session.uid]);
    res.redirect('/notifications');
});

module.exports = router;
