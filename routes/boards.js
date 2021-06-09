var express = require('express');
var router = express.Router();
const moment = require('moment');
const locale = moment.locale("ja");
const m = moment();
const {check, validationResult } = require('express-validator');
const now = new Date();
const cron = require('node-cron');
var { Client } = require('pg');
var client = new Client({
    // user: 'crdelgaerwibgg',
    // host: 'ec2-184-73-198-174.compute-1.amazonaws.com',
    // database: 'd4e10q2ggqa1jr',
    // password: 'fb7b8bdaff4285e9000264319d58a52e988217bf2de1139c5237d1ff02f200e3',
    // port: 5432
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});
 
client.connect();

const app_name = 'ToDo!!';
const spase = ' ';
const q_home_1 = "select id, user_id, title, to_char(date, 'YYYY-MM-DD') as date, to_char(due_date, 'YYYY-MM-DD') as due_date, to_char(due_time, 'HH24:MI') as due_time, case due_date when null then '1' else '0' end as dd_check, case due_time when null then '1' else '0' end as dt_check, class, priority, status, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as datetime from lists where user_id = $1 and date = $2 and updated_at is null";
const q_home_2 = "union select id, user_id, title, to_char(date, 'YYYY-MM-DD') as date, to_char(due_date, 'YYYY-MM-DD') as due_date, to_char(due_time, 'HH24:MI') as due_time, case due_date when null then '1' else '0' end as dd_check, case due_time when null then '1' else '0' end as dt_check, class, priority, status, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as datetime from lists where user_id = $1 and date = $2 and updated_at is not null";
const q_home_3 = "order by priority asc, dd_check asc, due_date asc, dt_check asc, due_time asc, datetime desc";

const q_list_1 = "select id, user_id, title, to_char(date, 'YYYY-MM-DD') as date, to_char(due_date, 'YYYY-MM-DD') as due_date, to_char(due_time, 'HH24:MI') as due_time, case due_date when null then '1' else '0' end as dd_check, case due_time when null then '1' else '0' end as dt_check, class, priority, status, due_date as ddt_order, due_time as dtm_order, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as datetime from lists where user_id = $1 and updated_at is null";
const q_list_2 = "union select id, user_id, title, to_char(date, 'YYYY-MM-DD') as date, to_char(due_date, 'YYYY-MM-DD') as due_date, to_char(due_time, 'HH24:MI') as due_time, case due_date when null then '1' else '0' end as dd_check, case due_time when null then '1' else '0' end as dt_check, class, priority, status, due_date as ddt_order, due_time as dtm_order, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as datetime from lists where user_id = $1 and updated_at is not null";
const q_list_3 = "order by date desc, dd_check asc, ddt_order desc, dt_check asc, dtm_order desc, datetime desc, priority asc" + spase;

// ----------------------------------
// 関数
// ---------------------------------

// ログインチェック
function LoginCheck(req,res){
    if(req.session.login == null){
        req.session.back = '/boards/home';
        res.redirect('/users/signin');
        return true;
    }else{
        return false;
    }
}

// 日付を表示用に成形
function showDate(date){
    const m_dt = moment(date);
    const year = m_dt.year();
    const month = m_dt.month() + 1;
    console.log(month);
    const dt = m_dt.date();
    var day = m_dt.day();
    const days = ['日','月','火','水','木', '金', '土'];
    for(var i in days){
        if(day == i){
            day = days[i];
        }
    }
    var show_dt = year + '年' + month + '月' + dt + '日' + '(' + day + ')';
    return show_dt;
}

// DBの値(数値)を表示用文字列に変換
function dataForShow(rows){
    const prio_new_vals = ['必須','高', '低', '-'];
    const rpt_new_vals = ['', '毎日', '毎週', '毎月', '平日', '土日祝'];
    for(var i in rows){
        for(var n in prio_new_vals){
            if(rows[i].priority == n){
                rows[i].priority = prio_new_vals[n];
            }
            if(rows[i].repeat == n){
                rows[i].repeat = rpt_new_vals[n];
            }
        }
    }
}
function prioForShow(rows){
    const prio_new_vals = ['必須','高', '低', '-'];
    for(var i in rows){
        for(var n in prio_new_vals){
            if(rows[i].priority == n){
                rows[i].priority = prio_new_vals[n];
            }
        }
    }
}
function rptForShow(rows){
    const rpt_new_vals = ['', '毎日', '毎週', '毎月', '平日', '土日祝'];
    for(var i in rows){
        for(var n in prio_new_vals){
            if(rows[i].repeat == n){
                rows[i].repeat = rpt_new_vals[n];
            }
        }
    }
}

// 受け取ったクエリオブジェクトからURLのクエリ部分作成
function queryUrlGenerator(req_query){
    const key_array = Object.keys(req_query);
    const val_array = Object.values(req_query);
    var query_url = '';
    for(var i in key_array){
        if(query_url == ''){
            query_url += '?' + key_array[i] + '=' + val_array[i];
        }else{
            query_url += '&' + key_array[i] + '=' + val_array[i];
        }
    }
    return query_url;
}

// 検索時SQLクエリ文作成
function sqlQueryForHome(req_query){
    const attr_nms = ['class', 'priority', 'status','due'];
    var q_vals = [];
    var q_1 = q_home_1;
    var q_2 = q_home_2;
    for(var i in attr_nms){
        if(req_query[attr_nms[i]] === "" || req_query[attr_nms[i]] === undefined){
            
        }else{
            if(attr_nms[i] == 'due'){
                var w_part = spase + 'and' + spase + '(due_date' + spase + 'is not null or' + spase + 'due_time' + spase + 'is not null)';
            }else{
                var w_part = spase + 'and' + spase + attr_nms[i] + spase + '= ';
                q_vals.push(req_query[attr_nms[i]]);
                w_part += '$' + (q_vals.length + 2);
            }
            q_1 += w_part;
            q_2 += w_part;
        }
    }
    const total_q = q_1 + spase + q_2 + spase + q_home_3;
    const sql_obj = {qs: total_q, vals: q_vals};
    return sql_obj;
}

function sqlQueryForList(req_query){
    const attr_nms = ['from','to', 'class', 'priority', 'status', 'due'];
    var q_vals = [];
    var q_1 = "";
    var q_2 = "";
    for(var i in attr_nms){
        if(req_query[attr_nms[i]] === "" || req_query[attr_nms[i]] === undefined){

        }else{
            if(attr_nms[i] == 'due'){
                var w_part = spase + 'and' + spase + '(due_date' + spase + 'is not null or' + spase + 'due_time' + spase + 'is not null)';
            }else if(attr_nms[i] == 'from'){
                var w_part = spase + 'and date >= ' ;
                q_vals.push(req_query[attr_nms[i]]);
                w_part += '$' + (q_vals.length + 1);
            }else if(attr_nms[i] == 'to'){
                var w_part = spase + 'and date <= ' ;
                q_vals.push(req_query[attr_nms[i]]);
                w_part += '$' + (q_vals.length + 1);
            }else if(attr_nms[i] == 'priority'){
                var w_part = spase + 'and' + spase + attr_nms[i] + spase + '= ';
                var val = parseInt(req_query[attr_nms[i]]);
                q_vals.push(val);
                w_part += '$' + (q_vals.length + 1);
            }else{
                var w_part = spase + 'and' + spase + attr_nms[i] + spase + '= ';
                q_vals.push(req_query[attr_nms[i]]);
                w_part += '$' + (q_vals.length + 1);
            }
            q_1 += w_part;
            q_2 += w_part;
        }
    }
    var limit = '$' + (q_vals.length + 2);
    var offset = '$' + (q_vals.length + 3);
    const total_q = q_list_1 + q_1 + spase + q_list_2 + q_2 + spase + q_list_3 + 'limit' + spase + limit + spase + 'offset' + spase + offset;
    const sql_obj = {qs: total_q, qp: q_1, vals: q_vals};
    return sql_obj;
}



// 複数リストのIDを数値に変換後配列にまとめる
function getIdsArray(id_array){
    var q_vals = [];
    if(id_array.length >= 0){
        for(var i in id_array){
            q_vals.push(Number(id_array[i]));
        }
    }
    return q_vals;
}

// 取得した日付が空の時値をnullに変える
function alterToNull(vals_array){
    for(var i in vals_array){
        if(vals_array[i] == ''){
            vals_array[i] = null;
            console.log(vals_array[i])
        }
    }
}

/* GET home page. */

router.get('/home', (req, res, next)=>{
    if(LoginCheck(req,res)){return};
    const ssnid = req.session.login.id;
    const ndt = m.format("YYYY-MM-DD");
    res.redirect('/boards/home/'+ ssnid + '?date=' + ndt);
});
router.get('/lists', (req, res, next)=>{
    if(LoginCheck(req,res)){return};
    const ssnid = req.session.login.id;
    res.redirect('/boards/lists/'+ ssnid + '/0/?lnum=20');
});
router.get('/add', (req, res, next)=>{
    if(LoginCheck(req,res)){return};
    const ssnid = req.session.login.id;
    res.redirect('/boards/add/'+ ssnid);
});
router.get('/home/:usrid', function(req, res, next) {
    req.session.path = req.url;
    if(LoginCheck(req,res)){return};
    const usrid = req.params.usrid;
    const d = req.query.date;
    const show_dt = showDate(d);
    const the_day_before = moment(d).add(-1, "day").format("YYYY-MM-DD");
    const the_day_after = moment(d).add(1, "day").format("YYYY-MM-DD");
    var msg;
    const req_query = req.query;
    const query_url = queryUrlGenerator(req_query);
    const json_query = JSON.stringify(req_query);
    const sql_obj = sqlQueryForHome(req_query);
    const vals = sql_obj.vals;
    console.log(vals);
    var input_vals = [usrid, d].concat(vals);
    // const input_vals_final = input_vals_1.concat(vals);
    console.log(input_vals);
    var msg;
    console.log(sql_obj.qs);
    const q = {
        text: sql_obj.qs,
        values: input_vals,
    };
    client.query(q, (err, res1) => {
        if(!err){
            if(res1.rows.length <= 0){
                msg = '<div class="text-center py-4">リストが登録されていません。</div>'
            }else{
                msg = '';
                prioForShow(res1.rows);   
            }
            var data = {
                login: req.session.login,
                lnum: req.session.lnum,
                user_id: usrid,
                query: json_query,
                title: 'ホーム',
                app_name: app_name,
                date: [show_dt, the_day_before, the_day_after, d],
                message: msg,
                content: res1.rows,
                filename: 'home'
            };
            console.log(data);
            res.render('boards/index', data);
        }
    });
});

router.post('/home/:usrid', (req, res, next)=>{
    req.session.path = req.url;
    if(LoginCheck(req,res)){return};
    const usrid = req.params.usrid;
    const d = req.query.date;
    const show_dt = showDate(d);
    const the_day_before = moment(d).add(-1, "day").format("YYYY-MM-DD");
    const the_day_after = moment(d).add(1, "day").format("YYYY-MM-DD");
    const req_query = req.query;
    const query_url = queryUrlGenerator(req_query);
    const json_query = JSON.stringify(req_query);
    const sql_obj = sqlQueryForHome(req_query);
    const vals = sql_obj.vals;
    console.log(vals);
    var input_vals = [usrid, d].concat(vals);
    // const input_vals_final = input_vals_1.concat(vals);
    console.log(input_vals);
    var msg;
    const q = {
        text: sql_obj.qs,
        values: input_vals
    };
    client.query(q, (err, res1) => {
        if(!err){
            if(res1.rows.length <= 0){
                msg = '<div class="text-center py-4">リストが登録されていません。</div>'
            }else{
                msg = '';
                prioForShow(res1.rows);   
            }
            var data = {
                login: req.session.login,
                lnum: req.session.lnum,
                user_id: usrid,
                query: json_query,
                title: 'ホーム',
                app_name: app_name,
                date: [show_dt, the_day_before, the_day_after, d],
                message: msg,
                content: res1.rows,
                filename: 'home'
            };
            console.log(data);
            res.render('boards/index', data);
        }
    });
});

router.get('/add/:usrid', function(req, res, next) {
    if(LoginCheck(req,res)){return};
    const ssnid = req.session.login.id;
    const usrid = req.params.usrid;
    const ssnpth = req.session.path;
    if(ssnid == usrid){
        var data = {
            login: req.session.login,
            lnum: req.session.lnum,
            user_id: usrid,
            title: 'リスト追加ページ',
            app_name: app_name,
            valid:'',
            content: {title:'', date:'', due_date:'',due_time:'',class:'',priority:'',repeat:''},
            filename: 'add'
        };
      res.render('boards/index', data);
    }else{
        if(ssnpth == null){
            res.redirect('/boards/home');
        }else{
            res.redirect('/boards' + ssnpth);
        }
    }
    
});

router.post('/add/:usrid/:option', [
    check('title','タイトルを入力してください。').notEmpty().escape(),
    check('date','日付を選択してください。').notEmpty().escape(),
    check('title','タイトルは50文字以下で入力してください。').custom(value =>{
      return value.length <= 50 ;
    }).escape(),
    check('memo','メモは200文字以下で入力してください。').custom(value =>{
        return value.length <= 200;
      }).escape()
  ], (req, res, next)=>{
    const errors = validationResult(req);
    const usrid = req.params.usrid;
    const option = req.params.option;
    const ssnid = req.session.login.id;
    const ssnpth = req.session.path;
    const ttl = req.body.title;
    var d = req.body.date;
    var dd = req.body.due_date;
    var dt = req.body.due_time;
    const cls = req.body.class;
    const prio = req.body.priority * 1;
    const rpt = req.body.repeat * 1;
    const memo = req.body.memo;

    
    if(!errors.isEmpty()){
        var result = '<ul class="text-danger py-3">';
        var result_arr = errors.array();
        for(var n in result_arr){
            result += '<li>' + result_arr[n].msg + '</li>';
        }
        result += '</ul>';
        var data = {
            login: req.session.login,
            lnum: req.session.lnum,
            user_id: usrid,
            title: 'リスト追加ページ',
            app_name: app_name,
            valid: result,
            content: req.body,
            filename: 'add'
        };
        res.render('boards/index', data);

    }else{
        const ndt = m.format('YYYY-MM-DD HH:mm:ss');
        var values = [];
        const val_array = [usrid, ttl, d, dd, dt, memo, cls, prio, rpt, ndt];
        for(var i in val_array){
            if(val_array[i] == ''){
                values.push(null)
            }else{
                values.push(val_array[i])
            }
        }
        const q = { 
            text: "insert into lists (user_id, title, date, due_date, due_time, memo, class, priority, repeat, created_at)" + " " + 
                    "values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            values: values
        };
        client.query(q, (err, res1) => {
            if (err) {
                console.log(err.stack)
            } else {
                console.log(res1.rows[0])
            }
        });
        if(option == 'again'){
            res.redirect('/boards/add/' + usrid);
        }else if(ssnpth == null){
            res.redirect('/boards/home');
        }else{
            res.redirect('/boards' + ssnpth);
        }
    }
    
});

router.get('/detail/:usrid/:lstid', function(req, res, next) {
    if(LoginCheck(req,res)){return};
    const ssnid = req.session.login.id;
    const usrid = req.params.usrid;
    const lstid = req.params.lstid;
    const ssnpth = req.session.path;
    if(ssnid == usrid){
            const q = { 
                text: "select id, user_id, title, to_char(date, 'YYYY-MM-DD') as date, to_char(due_date, 'YYYY-MM-DD') as due_date, to_char(due_time, 'HH24:MI') as due_time, memo, priority, status, repeat, to_char(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at, to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at from lists where id = $1",
                values: [lstid]
            };
            client.query(q, (err, res1) => {
                if(!err){
                    dataForShow(res1.rows);
                    var data = {
                        login: req.session.login,
                        lnum: req.session.lnum,
                        user_id: usrid,
                        title: 'リスト詳細ページ',
                        app_name: app_name,
                        content: res1.rows[0], 
                        filename: 'detail'
                    };
                  res.render('boards/index', data);
                }
            });
    }else{
        if(ssnpth == null){
            res.redirect('/boards/home');
        }else{
            res.redirect('/boards' + ssnpth);
        }
    }
});

router.get('/lists/:usrid/:page', function(req, res, next) {
    req.session.path = req.url;
    if(LoginCheck(req,res)){return};
    const usrid = req.params.usrid * 1;
    var pg = req.params.page * 1;
    const lnum = req.query.lnum * 1;
    req.session.lnum = lnum;
    const limit = lnum;
    const offset = pg * lnum;
    var msg;
    const req_query = req.query;
    const query_url = queryUrlGenerator(req_query);
    const json_query = JSON.stringify(req_query);
    console.log(json_query);
    const sql_obj = sqlQueryForList(req_query);
    const q_parts = sql_obj.qp;
    const vals = sql_obj.vals;
    console.log(vals);
    var input_vals_pt = [usrid].concat(vals);
    const input_vals = input_vals_pt.concat([limit, offset]);
    console.log(input_vals);
    const q = {
        text: sql_obj.qs,
        values: input_vals
    };
    console.log(q);
    const q2 = {
        text: "select count(*) as list_num from lists where user_id = $1" + spase + q_parts,
        values: input_vals_pt
    }; 

    if(pg < 0){
        pg = 0;
        res.redirect('/boards/lists/' + usrid + '/' + pg + '/' + query_url);
    }
    client.query(q, (err, res1) => {
        if(!err){
            console.log(res1.rows);
            if(res1.rows.length <= 0){
                client.query(q2, (err, res2) => {
                    if(!err){
                        if(res2.rows[0].list_num == 0){
                            var max_pg = 0;
                        }else{
                            var max_pg = Math.ceil(res2.rows[0].list_num / lnum) -1;  
                        }
                        console.log(max_pg);
                        if(pg > max_pg){
                            res.redirect('/boards/lists/' + usrid + '/'+ max_pg + '/' + query_url);                       
                        }else{
                            msg = '<div class="text-center py-4">リストが登録されていません。</div>';
                            var data = {
                                login: req.session.login,
                                lnum: req.session.lnum,
                                user_id: usrid,
                                page: pg,
                                list_num: lnum,
                                query: json_query,
                                title: 'リスト一覧',
                                app_name: app_name,
                                content: res1.rows,
                                message: msg,
                                filename: 'lists'
                            };
                            res.render('boards/index', data);
                        }
                    }                   
                });
                                
            }else{
                client.query(q2, (err, res2) => {
                    if(!err){
                        var max_pg = Math.ceil(res2.rows[0].list_num / lnum) -1;  
                        console.log(max_pg);
                        if(pg > max_pg){
                            pg = max_pg;
                            console.log(pg);
                            res.redirect('/boards/lists/' + usrid + '/' + pg + '/' + query_url);
                        }else{
                            prioForShow(res1.rows);   
                            var data = {
                                login: req.session.login,
                                lnum: req.session.lnum,
                                user_id: usrid,
                                page: pg,
                                list_num: lnum,
                                query: json_query,
                                title: 'リスト一覧',
                                app_name: app_name,
                                content: res1.rows,
                                message: msg,
                                filename: 'lists'
                            };
                            res.render('boards/index', data);
                        } 
                    }                   
                });

            }
        }
    });
          
});

router.post('/lists/:usrid/:page',(req, res, next)=>{
    req.session.path = req.url;
    const usrid = req.params.usrid * 1;
    const pg = req.params.page * 1;
    const lnum = req.query.lnum * 1;
    req.session.lnum = lnum;
    const limit = lnum;
    const offset = pg * lnum;
    var msg;
    const req_query = req.query;
    const json_query = JSON.stringify(req_query);
    console.log(json_query);
    const sql_obj = sqlQueryForList(req_query);
    const vals = sql_obj.vals;
    console.log(vals);
    var input_vals_pt = [usrid].concat(vals);
    const input_vals = input_vals_pt.concat([limit, offset]);
    console.log(input_vals);
    const q = {
        text: sql_obj.qs,
        values: input_vals
    };
    console.log(q);
    client.query(q, (err, res1) => {
        if(!err){
            if(res1.rows.length <= 0){
                msg = '<div class="text-center py-4">リストが登録されていません。</div>'
            }else{
                msg = '';
                prioForShow(res1.rows);   
            }
            var data = {
                login: req.session.login,
                lnum: req.session.lnum,
                login: {name: 'matsubara'},
                user_id: usrid,
                page: pg,
                list_num: lnum,
                query: json_query,
                title: 'リスト一覧',
                app_name: app_name,
                content: res1.rows,
                message: msg,
                filename: 'lists'
            };
            res.render('boards/index', data);
        }
    });
});

router.get('/edit/:usrid/:lstid', function(req, res, next) {
    if(LoginCheck(req,res)){return};
    const ssnid = req.session.login.id * 1;
    const lstid = req.params.lstid * 1;
    const usrid = req.params.usrid * 1;
    const ssnpth = req.session.path;
    if(ssnid == usrid){
        const q = { 
            text: "select U.id as usrid, U.name, L.id as lstid, L.title, to_char(L.date, 'YYYY-MM-DD') as date, to_char(L.due_date, 'YYYY-MM-DD') as due_date, to_char(L.due_time, 'HH24:MI:SS') as due_time, L.memo, L.class, L.priority, L.repeat, to_char(L.created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at, to_char(L.updated_at, 'YYYY-MM-DD HH24:MI:SS') as updated_at" + " " +
                    "from lists as L left join users as U on L.user_id = U.id where L.id = $1",
            values: [lstid]
        };
        client.query(q, (err, res1) => {
            if(!err){
                var data = {
                    login: req.session.login,
                    lnum: req.session.lnum,
                    user_id: usrid,
                    title: 'リスト編集ページ',
                    app_name: app_name,
                    valid:'',
                    content: res1.rows[0],
                    filename: 'edit'
                };
                res.render('boards/index', data);
            }else{
                console.log('error');
            }
        });
    }else{
        if(ssnpth == null){
            res.redirect('/boards/home');
        }else{
            res.redirect('/boards' + ssnpth);
        }
    }
    
});

router.post('/edit/:usrid/:lstid',  [
    check('title','タイトルを入力してください。').notEmpty().escape(),
    check('date','日付を選択してください。').notEmpty().escape(),
    check('title','タイトルは50文字以下で入力してください。').custom(value =>{
      return value.length <= 50 ;
    }).escape(),
    check('memo','メモは200文字以下で入力してください。').custom(value =>{
        return value.length <= 200;
      }).escape()
  ], (req, res, next)=>{
    const errors = validationResult(req);

    const ssnid = req.session.login.id * 1;
    const lstid = req.params.lstid * 1;
    const usrid = req.params.usrid * 1;
    const ttl = req.body.title;
    var d = req.body.date;
    var dd = req.body.due_date;
    var dt = req.body.due_time;
    const cls = req.body.class;
    const prio = req.body.priority * 1;
    const rpt = req.body.repeat * 1;
    const memo = req.body.memo;
    const ssnpth = req.session.path;

    if(!errors.isEmpty()){
        var result = '<ul class="text-danger py-3">';
        var result_arr = errors.array();
        for(var n in result_arr){
            result += '<li>' + result_arr[n].msg + '</li>';
        }
        result += '</ul>';
        var data = {
            login: req.session.login,
            lnum: req.session.lnum,
            user_id: usrid,
            title: 'リスト編集ページ',
            app_name: app_name,
            valid: result,
            content: req.body,
            filename: 'edit'
        };
        res.render('boards/index', data);

    }else{
        const ndt = m.format('YYYY-MM-DD HH:mm:ss');
        var values = [];
        const val_array = [usrid, ttl, d, dd, dt, memo, cls, prio, rpt, ndt, lstid];
        for(var i in val_array){
            if(val_array[i] == ''){
                values.push(null)
            }else{
                values.push(val_array[i])
            }
        }
        const q = { 
            text: "update lists set user_id = $1, title = $2, date = $3, due_date = $4, due_time = $5, memo = $6, class = $7, priority = $8, repeat = $9, updated_at = $10" +
                    " " + "where id = $11",
            values: values
        };
        
        client.query(q, (err, res1) => {
            if (err) {
                console.log(err.stack)
            } else {
                console.log(res1.rows[0])
            }
        });
        if(ssnpth == null){
            res.redirect('/boards/home');
        }else{
            res.redirect('/boards' + ssnpth);
        }    

    }
});

router.get('/delete/:usrid/:lstid', (req, res, next)=>{
    const usrid = req.params.usrid * 1;
    const lstid = req.params.lstid * 1;
    const ssnid = req.session.login.id;
    const ssnpth = req.session.path;
    if(ssnid == usrid){
        const q = {
            text: "delete from lists where id = $1",
            values: [lstid]
        };
        client.query(q, (err, res1) => {
            if (err) {
                console.log(err.stack)
            } else {
                console.log(res1.rows[0])
            }
        });
    }
    if(ssnpth == null){
        res.redirect('/boards/home');
    }else{
        res.redirect('/boards' + ssnpth);
    }
});
router.post('/delete/:usrid', (req, res, next)=>{
    if(LoginCheck(req,res)){return};
    const ssnid = req.session.login.id;
    const ssnpth = req.session.path;
    const dt = req.query.date;
    const usrid = req.params.usrid;
    const ids = req.body.lstids;
    const ids_string = ids.split(',');
    console.log(ids_string);
    const ids_int = getIdsArray(ids_string);
    console.log(ids_int);
        if(ids_int.length > 0){
            for(var i in ids_int){
                var q = {
                    text: "delete from lists where id = $1",
                    values: [ids_int[i]]
                };
                client.query(q, (err, res1) => {
                    if (err) {
                        console.log(err.stack)
                    } else {
                        console.log(res1.rows[0])
                    }
                });
            }
        }
    if(ssnpth == null){
        res.redirect('/boards/home');
    }else{
        res.redirect('/boards' + ssnpth);
    }
});

router.get('/status/:usrid/:lstid/:val', (req, res, next)=>{
    const usrid = req.params.usrid * 1;
    const lstid = req.params.lstid * 1;
    const crrnt_val = req.params.val;
    const ssnid = req.session.login.id;
    const ssnpth = req.session.path;
    if(ssnid == usrid){
        const q1 = {
            text: "update lists set status = '完了' where id = $1",
            values: [lstid]
        };
        const q2 = {
            text: "update lists set status = '未完了' where id = $1",
            values: [lstid]
        };
        if(crrnt_val == '未完了'){
            client.query(q1, (err, res1) => {
                if (err) {
                    console.log(err.stack)
                } else {
                    console.log(res1.rows[0])
                }
            });
        }else if(crrnt_val == '完了'){
            client.query(q2, (err, res1) => {
                if (err) {
                    console.log(err.stack)
                } else {
                    console.log(res1.rows[0])
                }
            });
        }
            
    }
    if(ssnpth == null){
        res.redirect('/boards/home');
    }else{
        res.redirect('/boards' + ssnpth);
    }
});
router.post('/status/:usrid', (req, res, next)=>{
    if(LoginCheck(req,res)){return};
    const ssnid = req.session.login.id;
    const ssnpth = req.session.path;
    const dt = req.query.date;
    const usrid = req.params.usrid;
    const ids = req.body.lstids;
    const ids_string = ids.split(',');
    console.log(ids_string);
    const ids_int = getIdsArray(ids_string);
    console.log(ids_int);
        if(ids_int.length > 0){
            for(var i in ids_int){
                const q = {
                    text: "update lists set status = '完了' where id = $1",
                    values: [ids_int[i]]
                };
                client.query(q, (err, res1) => {
                    if (err) {
                        console.log(err.stack)
                    } else {
                        console.log(res1.rows[0])
                    }
                });
            }
        }
    if(ssnpth == null){
        res.redirect('/boards/home');
    }else{
        res.redirect('/boards' + ssnpth);
    }
});

module.exports = router;