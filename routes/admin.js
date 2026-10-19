var express=require('express');
var router=express.Router();
var mysql=require('mysql2');
var util=require('util');
var session=require('express-session');
var fileupload=require('express-fileupload');
var path=require('path');

router.use(express.static('public'));

var conn=mysql.createConnection({
    host : 'localhost',
    user : 'root',
    password : 'root',
    database : 'shelf'
})
var exe=util.promisify(conn.query).bind(conn);
router.use(express.urlencoded({extended:true}));
router.use(session({
    secret:'A2ZITHUB',
    resave : false,
    saveUninitialized:true 
}))
router.use(fileupload());

function logincheck(req,res,next){
    if(req.session.email){
        next();
    }else{
        res.redirect('/admin');
    }
}

router.get('/',(req,res)=>{
    res.render('admin/login.ejs');
})

router.post('/login_check',async(req,res)=>{
    // res.redirect('dashboard');
    // res.send(req.body);
    var {email,password}=req.body
    var sql=`select * from admin where email=? and password=?`;
    var data=await exe(sql,[email,password]);
    // res.send(data);
    if(data[0]){
        // session data store
        req.session.id=data[0].lid;
        req.session.email=data[0].email;
        res.redirect('/admin/dashboard');
    }else{
        res.redirect('/admin');
    }

})
router.get('/dashboard',logincheck,async(req,res)=>{
    const totalProducts = await exe(`SELECT COUNT(*) AS total FROM products`);
    const soldProducts  = await exe(`SELECT COUNT(*) AS total FROM products WHERE status = 'sold'`);
    const totalUsers    = await exe(`SELECT COUNT(*) AS total FROM users`);
    const recentUsers   = await exe(`SELECT * FROM users ORDER BY uid DESC LIMIT 5`);

    res.render('admin/index.ejs', {
        totalProducts: totalProducts[0].total,
        soldProducts:  soldProducts[0].total,
        totalUsers:    totalUsers[0].total,
        recentUsers:   recentUsers
    });
})

router.get('/Products',logincheck,async(req,res)=>{
    var sql =`select * from products where status="available"`;
    var products=await exe(sql);
    res.render('admin/products.ejs',{products:products});
})

router.post('/product_update/:id', logincheck, async (req, res) => {
    var sql = `select * from products where p_id=?`;
    var data = await exe(sql, [req.params.id]);
    res.render('admin/product_edit.ejs', { products: data });
});

router.post('/product_update_save', logincheck, async (req, res) => {
    var { p_name, p_category, p_price, p_condition, p_desc, address } = req.body;

    var sql = `UPDATE products 
                 SET p_category=?, p_name=?, p_price=?, p_condition=?, p_desc=?, address=? 
                 WHERE p_id=?`;

    await exe(sql, [p_category, p_name, p_price, p_condition, p_desc, address, req.params.p_id]);
    res.redirect('/admin/products');
});

router.post('/product_delete/:id/:name', logincheck, async (req, res) => {
    await exe('DELETE FROM products WHERE p_id=? AND p_name=?', [req.params.id,req.params.name]);
    res.redirect('/admin/products');
});

router.post('/product_sold/:id/:name', logincheck, async (req, res) => {
    await exe('UPDATE products SET status=? WHERE p_id=?', ['sold' , req.params.id]);
    res.redirect('/admin/products');
});


router.get('/Users',logincheck,async(req,res)=>{
    var sql =`select * from users`;
    var users=await exe(sql);
    res.render('admin/users.ejs',{users:users});
})
router.post('/user_update/:id', logincheck, async (req, res) => {
    var sql = `select * from users where uid=?`;
    var data = await exe(sql, [req.params.id]);
    res.render('admin/user_edit.ejs', { users: data });
});
router.post('/user_update_save', logincheck, async (req, res) => {
    var { name, contact, address } = req.body;
    var sql = 'UPDATE users SET name=?,contact=?,address=? WHERE uid=?'
    await exe(sql, [name, contact, address, req.params.id]);
    res.redirect('/admin/users');
});

router.post('/user_delete/:id/:name', logincheck, async (req, res) => {
    var sql1 = 'DELETE FROM users WHERE uid=? AND name=?'
    var sql2 = 'DELETE FROM products WHERE uid=?'
    await exe(sql1, [req.params.id,req.params.name]);
    await exe(sql2, [req.params.id]);
    res.redirect('/admin/users');
});

router.get('/logout',(req,res)=>{
    req.session.destroy();
    res.redirect('/admin')
})






module.exports=router;
