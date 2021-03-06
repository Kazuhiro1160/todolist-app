var express = require('express');
var router = express.Router();
var { Client } = require('pg');
var client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
 
client.connect();
const {check, validationResult } = require('express-validator');

/* GET users listing. */
router.get('/signin', function(req, res, next) {
  var data = {
      title: 'サインイン画面',
      content: 'ユーザー名とパスワードを入力してください。',
      form: {name:'', pass:''},
      btn_nm: 'サインイン',
      route: 'signin',
      link_to: 'signup',
      link_txt: '新規登録'
  }
  res.render('users/sign', data);
});

router.get('/signup', function(req, res, next) {
  var data = {
      title: '新規登録画面',
      content: 'ユーザー名とパスワードを入力してください。',
      form: {name:'', pass:''},
      btn_nm: '新規登録',
      route: 'signup',
      link_to: 'signin',
      link_txt: 'サインイン'
  }
  res.render('users/sign', data);
});

router.get('/signout', (req, res, next)=>{
  req.session.login = null;
  res.redirect('/users/signin');
});

router.post('/signin', [
  check('name','ユーザー名は必ず入力してください。').notEmpty().escape(),
  check('password','パスワードは必ず入力してください。').notEmpty().escape(),
  check('name','ユーザー名は20文字以下で入力してください。').custom(value =>{
    return value.length >= 0 & value.length <= 20;
  }).escape(),
  check('password','パスワードは4文字以上8文字以下で入力してください。').custom(value =>{
    if(value.length > 0){
      return value.length >= 4 & value.length <= 8;
    }else{
      return true;
    }
  }).escape()
], (req, res, next)=>{
  const errors = validationResult(req);
  if(!errors.isEmpty()){
    var result = '<ul class="text-danger">';
      var result_arr = errors.array();
      for(var n in result_arr){
        result += '<li>' + result_arr[n].msg + '</li>';
      }
      result += '</ul>';
      var data ={
        title: 'サインイン画面',
        content: result,
        form: req.body,
        btn_nm: 'サインイン',
        route: 'signin',
        link_to: 'signup',
        link_txt: '新規登録'
      };
      res.render('users/sign', data);
  }else{
    const nm = req.body.name;
    const ps = req.body.password;
      const q = {
        text: 'select * from users where name = $1 and password = $2',
        values: [nm, ps],
      };
      client.query(q, (err, res1) => {
        if(res1.rows[0] != undefined){
          req.session.login = res1.rows[0];
          let back = req.session.back;
          if(back == null){
            back = '/boards/home';
          }
          console.log(back);
          res.redirect(back);
        }else{
          var data ={
            title: 'サインイン画面',
            content: '<ul class="text-danger"><li>ユーザー名とパスワードが一致しません。</li></ul>',
            form: req.body,
            btn_nm: 'サインイン',
            route: 'signin',
            link_to: 'signup',
            link_txt: '新規登録'
          };
          res.render('users/sign', data);
        }
      });
  }
  
});

router.post('/signup', [
  check('name','ユーザー名は必ず入力してください。').notEmpty().escape(),
  check('password','パスワードは必ず入力してください。').notEmpty().escape(),
  check('name','ユーザー名は20文字以下で入力してください。').custom(value =>{
    return value.length <= 20;
  }).escape(),
  check('password','パスワードは4文字以上8文字以下の半角英数字で入力してください。').custom(value =>{
    const regex = /^[A-Za-z0-9]+$/;
    if(value.length > 0){
      return value.length >= 4 & value.length <= 8 & regex.test(value);
    }else{
      return true;
    }
  }).escape(),
], (req, res, next)=>{
  const errors = validationResult(req);
  if(!errors.isEmpty()){
    var result = '<ul class="text-danger">';
      var result_arr = errors.array();
      for(var n in result_arr){
        result += '<li>' + result_arr[n].msg + '</li>';
      }
      result += '</ul>';
      var data ={
        title: 'サインイン画面',
        content: result,
        form: req.body,
        btn_nm: '新規登録',
        route: 'signup',
        link_to: 'signin',
        link_txt: 'サインイン'
      };
      res.render('users/sign', data);
  }else{
    const nm = req.body.name;
    const ps = req.body.password;
      const q1 = {
        text: "select count(*) as count from users where name = $1 and password = $2",
        values: [nm, ps]
      };
      const q2 = {
        text: "insert into users(name, password) values($1,$2)",
        values: [nm, ps]
      };
      client.query(q1, (err, res1) => {
        if(!err){
          if(res1.rows[0].count == 0){
            client.query(q2, (err, res2) => {
              if (err) {
                  console.log(err.stack)
              } else {
                  console.log(res2.rows[0])
              }
            });
            res.redirect('/users/signin');
          }else{
            var data ={
              title: 'サインイン画面',
              content: '<ul class="text-danger"><li>別のユーザー名またはパスワードを設定してください。</li></ul>',
              form: req.body,
              btn_nm: '新規登録',
              route: 'signup',
              link_to: 'signin',
              link_txt: 'サインイン'
            };
            res.render('users/sign', data);
          }
        }
      })
  }
  
});

module.exports = router;