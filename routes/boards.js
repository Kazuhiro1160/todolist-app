var express = require('express');
var router = express.Router();
const sqlite3 = require('sqlite3');
const moment = require('moment');
const locale = moment.locale("ja");
const m = moment();
const db = new sqlite3.Database('todo_lists.sqlite3');
const {check, validationResult } = require('express-validator');
const now = new Date();
const cron = require('node-cron');

const app_name = 'ToDo!!';
const spase = ' ';
const q_home_1 = "select id, user_id, title, date, due_date, due_time, case due_date when '' then '1' else '0' end as dd_check, case due_time when '' then '1' else '0' end as dt_check, class, priority, status, created_at as datetime from List where user_id = ? and date = ? and updated_at is null";
const q_home_2 = "union select id, user_id, title, date, due_date, due_time, case due_date when '' then '1' else '0' end as dd_check, case due_time when '' then '1' else '0' end as dt_check, class, priority, status, updated_at as datetime from List where user_id = ? and date = ? and updated_at is not null";
const q_home_3 = "order by priority asc, dd_check asc, due_date asc, dt_check asc, due_time asc, datetime desc";

const q_list_1 = "select *, due_date, due_time, case due_date when '' then '1' else '0' end as dd_check, case due_time when '' then '1' else '0' end as dt_check, created_at as datetime from List where user_id = ? and updated_at is null";
const q_list_2 = "union select *, due_date, due_time, case due_date when '' then '1' else '0' end as dd_check, case due_time when '' then '1' else '0' end as dt_check, updated_at as datetime from List where user_id = ? and updated_at is not null";
const q_list_3 = "order by date desc, dd_check asc, due_date desc, dt_check asc, due_time desc, datetime desc, priority asc limit ?,?";

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
                var w_part = spase + 'and' + spase + '(due_date' + spase + '!= "" or' + spase + 'due_time' + spase + '!= "")';
            }else{
                var w_part = spase + 'and' + spase + attr_nms[i] + spase + '= ?';
                q_vals.push(req_query[attr_nms[i]]);
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
                var w_part = spase + 'and' + spase + '(due_date' + spase + '!= "" or' + spase + 'due_time' + spase + '!= "")';
            }else if(attr_nms[i] == 'from'){
                var w_part = spase + 'and date >= ?' ;
                q_vals.push(req_query[attr_nms[i]]);
            }else if(attr_nms[i] == 'to'){
                var w_part = spase + 'and date <= ?' ;
                q_vals.push(req_query[attr_nms[i]]);
            }else if(attr_nms[i] == 'priority'){
                var w_part = spase + 'and' + spase + attr_nms[i] + spase + '= ?';
                var val = parseInt(req_query[attr_nms[i]]);
                q_vals.push(val);
            }else{
                var w_part = spase + 'and' + spase + attr_nms[i] + spase + '= ?';
                q_vals.push(req_query[attr_nms[i]]);
            }
            q_1 += w_part;
            q_2 += w_part;
        }
    }
    const total_q = q_list_1 + q_1 + spase + q_list_2 + q_2 + spase + q_list_3;
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
    const q = sql_obj.qs;
    console.log(q);
    const vals = sql_obj.vals;
    console.log(vals);
    var input_vals_1 = [usrid, d].concat(vals);
    var input_vals_2 = [usrid, d].concat(vals);
    const input_vals_final = input_vals_1.concat(input_vals_2);
    console.log(input_vals_final);
    var msg;
    db.serialize(()=>{
        db.all(q, input_vals_final, (err, rows)=>{
            if(!err){
                if(rows.length <= 0){
                    msg = '<div class="text-center py-4">リストが登録されていません。</div>'
                }else{
                    msg = '';
                    prioForShow(rows);   
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
                    content: rows,
                    filename: 'home'
                };
                console.log(data);
                res.render('boards/index', data);
            }
        });
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
    const q = sql_obj.qs;
    console.log(q);
    const vals = sql_obj.vals;
    console.log(vals);
    var input_vals_1 = [usrid, d].concat(vals);
    var input_vals_2 = [usrid, d].concat(vals);
    const input_vals_final = input_vals_1.concat(input_vals_2);
    console.log(input_vals_final);
    var msg;
    db.serialize(()=>{
        db.all(q, input_vals_final, (err, rows)=>{
            if(!err){
                if(rows.length <= 0){
                    msg = '<div class="text-center py-4">リストが登録されていません。</div>'
                }else{
                    msg = '';
                    prioForShow(rows);   
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
                    content: rows,
                    filename: 'home'
                };
                console.log(data);
                res.render('boards/index', data);
            }
        });
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
    const session_id = req.session.login.id;
    const ssnpth = req.session.path;
    const ttl = req.body.title;
    const d = req.body.date;
    const dd = req.body.due_date;
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
        db.serialize(()=>{
            const q = "insert into List (user_id, title, date, due_date, due_time, memo, class, priority, repeat, created_at)" + " " + 
                        "values(?,?,?,?,?,?,?,?,?,?)";
            const ndt = m.format('YYYY-MM-DD HH:mm:ss');

            db.run(q, session_id, ttl, d, dd, dt, memo, cls, prio, rpt, ndt);
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
        db.serialize(()=>{
            const q = "select * from List where id = ?";
            db.get(q, [lstid], (err, row)=>{
                if(!err){
                    var to_array = [];
                    to_array.push(row);
                    dataForShow(to_array);
                    var data = {
                        login: req.session.login,
                        lnum: req.session.lnum,
                        user_id: usrid,
                        title: 'リスト詳細ページ',
                        app_name: app_name,
                        content: row,
                        filename: 'detail'
                    };
                  res.render('boards/index', data);
                }
            });
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
    const limit = lnum * (pg + 1);
    const offset = pg * lnum;
    var msg;
    const req_query = req.query;
    const query_url = queryUrlGenerator(req_query);
    const json_query = JSON.stringify(req_query);
    console.log(json_query);
    const sql_obj = sqlQueryForList(req_query);
    const q = sql_obj.qs;
    console.log(q);
    const q_parts = sql_obj.qp;
    const vals = sql_obj.vals;
    console.log(vals);
    const input_vals_1 = [usrid].concat(vals);
    const input_vals_2 = [usrid].concat(vals);
    const input_vals_3 = input_vals_1.concat(input_vals_2);
    const input_vals_final = input_vals_3.concat([offset, limit]);
    console.log(input_vals_final);

    if(pg < 0){
        pg = 0;
        res.redirect('/boards/lists/' + usrid + '/' + pg + '/' + query_url);
    }
    db.serialize(()=>{
        const q2 = "select count(*) as list_num from List where user_id = ?" + spase + q_parts;        
        db.all(q, input_vals_final, (err, rows)=>{
            if(!err){
                console.log(rows);
                if(rows.length <= 0){
                    db.get(q2,input_vals_1,(err, row)=>{
                        if(!err){
                            if(row.list_num == 0){
                                var max_pg = 0;
                            }else{
                                var max_pg = Math.ceil(row.list_num / lnum) -1;  
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
                                    content: rows,
                                    message: msg,
                                    filename: 'lists'
                                };
                                res.render('boards/index', data);
                            }
                        }                   
                    });
                                 
                }else{
                    db.get(q2,input_vals_1,(err, row)=>{
                        if(!err){
                            var max_pg = Math.ceil(row.list_num / lnum) -1;  
                            console.log(max_pg);
                            if(pg > max_pg){
                                pg = max_pg;
                                console.log(pg);
                                res.redirect('/boards/lists/' + usrid + '/' + pg + '/' + query_url);
                            }else{
                                prioForShow(rows);   
                                var data = {
                                    login: req.session.login,
                                    lnum: req.session.lnum,
                                    user_id: usrid,
                                    page: pg,
                                    list_num: lnum,
                                    query: json_query,
                                    title: 'リスト一覧',
                                    app_name: app_name,
                                    content: rows,
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
  
});

router.post('/lists/:usrid/:page',(req, res, next)=>{
    req.session.path = req.url;
    const usrid = req.params.usrid * 1;
    const pg = req.params.page * 1;
    const lnum = req.query.lnum * 1;
    req.session.lnum = lnum;
    const offset = pg * lnum;
    var msg;
    const req_query = req.query;
    const json_query = JSON.stringify(req_query);
    console.log(json_query);
    const sql_obj = sqlQueryForList(req_query);
    const q = sql_obj.qs;
    console.log(q);
    const vals = sql_obj.vals;
    console.log(vals);
    var input_vals_1 = [usrid].concat(vals);
    var input_vals_2 = [usrid].concat(vals);
    var input_vals_3 = input_vals_1.concat(input_vals_2);
    const input_vals_final = input_vals_3.concat([offset, lnum]);

    console.log(input_vals_final);
    db.serialize(()=>{
        db.all(q, input_vals_final, (err, rows)=>{
            if(!err){
                if(rows.length <= 0){
                    msg = '<div class="text-center py-4">リストが登録されていません。</div>'
                }else{
                    msg = '';
                    prioForShow(rows);   
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
                    content: rows,
                    message: msg,
                    filename: 'lists'
                };
                res.render('boards/index', data);
            }
        });
    });
});

router.get('/edit/:usrid/:lstid', function(req, res, next) {
    if(LoginCheck(req,res)){return};
    const ssnid = req.session.login.id * 1;
    const lstid = req.params.lstid * 1;
    const usrid = req.params.usrid * 1;
    const ssnpth = req.session.path;
    if(ssnid == usrid){
        db.serialize(()=>{
            const q = "select U.id as usrid, U.name, L.id as lstid, L.title, L.date, L.due_date, L.due_time, L.memo, L.class, L.priority, L.repeat, L.created_at, L.updated_at" + " " +
                        "from List as L left join User as U on L.user_id = U.id where L.id = ?"
            db.get(q, [lstid], (err, row)=>{
                if(!err){
                    var data = {
                        login: req.session.login,
                        lnum: req.session.lnum,
                        user_id: usrid,
                        title: 'リスト編集ページ',
                        app_name: app_name,
                        valid:'',
                        content: row,
                        filename: 'edit'
                    };
                    res.render('boards/index', data);
                }else{
                    console.log('error');
                }
            });
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
    const d = req.body.date;
    const dd = req.body.due_date;
    const dt = req.body.due_time;
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
        db.serialize(()=>{
            // const q_parts = ['user_id', 'title', 'date', 'due_time', 'memo', 'class', 'priority', 'repeat', 'updated_at'];
            // var q = "update List set "
            // for(var i in q_parts){
            //     q += q_parts[i] + ' = ?,' + ' ';
            // }
            // q = q.slice(0,-2) + ' ' + 'where id = ?';
            // console.log(q);
            const q = "update List set user_id = ?, title = ?, date = ?, due_date = ?, due_time = ?, memo = ?, class = ?, priority = ?, repeat = ?, updated_at = ?" +
                        " " + "where id = ?";
            const ndt = m.format('YYYY-MM-DD HH:mm:ss');
            db.run(q, usrid, ttl, d, dd, dt, memo, cls, prio, rpt, ndt, lstid);
        });
        if(ssnpth == null){
            res.redirect('/boards/home');
        }else{
            res.redirect('/boards' + ssnpth);
        }    

    }
});

// router.get('/delete/:usrid/:lstid/:pgname/:pg', (req, res, next)=>{
//     const usrid = req.params.usrid * 1;
//     const lstid = req.params.lstid * 1;
//     const pgname = req.params.pgname;
//     const pg = req.params.pg;
//     const ssnid = req.session.login.id;
//     const req_query = req.query;
//     const query_url = queryUrlGenerator(req_query);
//     if(ssnid == usrid){
//         console.log('before db.serialize');
//         db.serialize(()=>{
//             const q = "delete from List where id = ?"
//             db.run(q, lstid);
//         });
//     }
//     if(pgname == 'home'){
//         var redirect_to = '/boards/home/' + usrid + '/' +  query_url;
//     }else if(pgname == 'lists'){
//         var redirect_to = '/boards/lists/' + usrid + '/' + pg + '/' +  query_url;
//     }
//     res.redirect(redirect_to);
    
// });
router.get('/delete/:usrid/:lstid', (req, res, next)=>{
    const usrid = req.params.usrid * 1;
    const lstid = req.params.lstid * 1;
    const ssnid = req.session.login.id;
    const ssnpth = req.session.path;
    if(ssnid == usrid){
        console.log('before db.serialize');
        db.serialize(()=>{
            const q = "delete from List where id = ?"
            db.run(q, lstid);
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
    db.serialize(()=>{
        const q = "delete from List where id = ?";
        if(ids_int.length > 0){
            for(var i in ids_int){
                db.run(q, ids_int[i]);
            }
        }
    });
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
        db.serialize(()=>{
            const q1 = "update List set status = '完了' where id = ?";
            const q2 = "update List set status = '未完了' where id = ?";
            if(crrnt_val == '未完了'){
                db.run(q1, lstid);
            }else if(crrnt_val == '完了'){
                db.run(q2, lstid);
            }
            
        });
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
    db.serialize(()=>{
        const q = "update List set status = '完了' where id = ?";
        if(ids_int.length > 0){
            for(var i in ids_int){
                db.run(q, ids_int[i]);
            }
        }
    });
    if(ssnpth == null){
        res.redirect('/boards/home');
    }else{
        res.redirect('/boards' + ssnpth);
    }
});

module.exports = router;