var express=require('express');
var path=require('path');
var app=express();

app.set('views', path.join(__dirname,'views'));
app.set('view engine','ejs');

var web=require('./routes/web.js')
var admin=require('./routes/admin.js')

app.use('/',web);
app.use('/admin',admin);

app.listen(3000,()=>console.log('CampusShelf running at http://localhost:3000'));
