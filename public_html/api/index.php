<?php
declare(strict_types=1);
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');
ini_set('display_errors', '0');
session_name('prestige_session');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off','httponly'=>true,'samesite'=>'Strict']);
session_start();
$_SESSION['csrf'] ??= bin2hex(random_bytes(32));
$private = getenv('PRESTIGE_PRIVATE') ?: dirname(__DIR__, 2) . '/prestige-private';
require $private . '/bootstrap.php';

try {
    $action = $_GET['action'] ?? 'bootstrap';
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'GET' && $action === 'bootstrap') {
        $configured = is_file(getenv('PRESTIGE_CONFIG') ?: $private . '/config.php');
        $isInstalled = $configured && installed();
        json_response(['csrf'=>$_SESSION['csrf'],'configured'=>$configured,'installed'=>$isInstalled,'user'=>$isInstalled ? current_user() : null,'automation'=>$isInstalled && automation_ready()]);
    }
    if ($method !== 'GET' && $method !== 'POST') fail('Method not allowed.', 405);
    if ($method === 'POST' && $action !== 'callback') csrf();
    if ($action === 'setup' && $method === 'POST') {
        if (installed()) fail('Setup is already complete.', 409);
        $d = body();
        $secret = config()['setup_token'] ?? '';
        if (strlen($secret) < 32 || str_starts_with($secret,'CHANGE_') || !hash_equals($secret, $d['token'] ?? '')) fail('Invalid setup token.', 403);
        $name = text_field($d,'name',120); $email = valid_email($d); $password = text_field($d,'password',200);
        if (strlen($password) < 12) fail('Use a password with at least 12 characters.');
        schema();
        // Serialize initial ownership creation across concurrent installer requests.
        db()->beginTransaction();
        if (db()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') {
            $lock = query("SELECT GET_LOCK('prestige_initial_setup',5)")->fetchColumn();
            if ((int)$lock !== 1) { db()->rollBack(); fail('Setup is busy. Try again.',409); }
        }
        if (installed()) { db()->rollBack(); fail('Setup is already complete.',409); }
        $uid=id();query('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',[$uid,$name,$email,password_hash($password,PASSWORD_DEFAULT),'admin',now()]);
        db()->commit();
        if (db()->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql') query("SELECT RELEASE_LOCK('prestige_initial_setup')");
        session_regenerate_id(true); $_SESSION['user_id']=$uid;
        json_response(['user'=>current_user()],201);
    }
    if (!installed()) fail('Website setup is not complete. Please contact Prestige Inmedia.',503);
    if ($method === 'POST' && in_array($action,['login','register'],true)) {
        rate_limit('authentication',15);$d=body();$email=valid_email($d);$password=text_field($d,'password',200);
        if ($action === 'register') {
            $name=text_field($d,'name',120);
            if(strlen($password)<12) fail('Use a password with at least 12 characters.');
            if(query('SELECT id FROM users WHERE email=?',[$email])->fetch()) fail('Unable to create this account. Try signing in.',409);
            $uid=id();query('INSERT INTO users(id,name,email,password_hash,role,created_at) VALUES(?,?,?,?,?,?)',[$uid,$name,$email,password_hash($password,PASSWORD_DEFAULT),'client',now()]);
        } else {
            $u=query('SELECT * FROM users WHERE email=?',[$email])->fetch();
            if(!$u || !password_verify($password,$u['password_hash'])) fail('Email or password is incorrect.',401);
            $uid=$u['id'];
        }
        session_regenerate_id(true);$_SESSION['user_id']=$uid;
        json_response(['user'=>current_user()]);
    }
    if ($action==='logout' && $method==='POST') { $_SESSION=['csrf'=>bin2hex(random_bytes(32))];session_regenerate_id(true);json_response(['ok'=>true,'csrf'=>$_SESSION['csrf']]); }
    if ($action==='enquiry' && $method==='POST') {
        rate_limit('enquiry',8);$d=body();
        if(!empty($d['website_extra'])) json_response(['ok'=>true]);
        $name=text_field($d,'name',120);$email=valid_email($d);$company=text_field($d,'company',160);$service=text_field($d,'service',100);$message=text_field($d,'message',5000);
        $eid=id();query('INSERT INTO enquiries(id,name,email,company,service,message,status,created_at) VALUES(?,?,?,?,?,?,?,?)',[$eid,$name,$email,$company,$service,$message,'new',now()]);
        json_response(['ok'=>true,'reference'=>substr($eid,0,8)],201);
    }
    if ($action==='callback' && $method==='POST') {
        callback_bearer();$d=body();$jid=text_field($d,'job_id',32);$status=text_field($d,'status',30);
        if(!in_array($status,['review','failed'],true)) fail('Callback status must be review or failed.');
        $job=query('SELECT * FROM jobs WHERE id=?',[$jid])->fetch();if(!$job)fail('Job not found.',404);
        // Ignore duplicate or late deliveries after a client has approved or requested changes.
        if(!in_array($job['status'],['dispatching','processing'],true)) json_response(['ok'=>true,'ignored'=>true]);
        if(empty($job['dispatch_token']) || !hash_equals($job['dispatch_token'],$d['dispatch_token']??'')) fail('Stale delivery token.',409);
        $result=$d['result']??[];if(!is_array($result))fail('Invalid result.');
        foreach(['canva_url','download_url'] as $key) {
            if(!empty($result[$key]) && (!is_string($result[$key]) || !filter_var($result[$key],FILTER_VALIDATE_URL) || parse_url($result[$key],PHP_URL_SCHEME)!=='https')) fail('Result links must use HTTPS.');
        }
        query('UPDATE jobs SET status=?,result_json=?,updated_at=? WHERE id=?',[$status,json_encode($result,JSON_THROW_ON_ERROR),now(),$jid]);event($jid,$status==='review'?'Creative output is ready for review.':'The connected workflow reported a failure.');json_response(['ok'=>true]);
    }
    $u=require_user();
    if($action==='workspace' && $method==='GET') {
        $admin=$u['role']==='admin';
        $brands=$admin?query('SELECT * FROM brands ORDER BY created_at DESC')->fetchAll():query('SELECT * FROM brands WHERE user_id=? ORDER BY created_at DESC',[$u['id']])->fetchAll();
        $jobs=$admin?query('SELECT j.*,b.name AS brand_name FROM jobs j JOIN brands b ON j.brand_id=b.id ORDER BY j.created_at DESC LIMIT 200')->fetchAll():query('SELECT j.*,b.name AS brand_name FROM jobs j JOIN brands b ON j.brand_id=b.id WHERE j.user_id=? ORDER BY j.created_at DESC LIMIT 200',[$u['id']])->fetchAll();
        foreach($jobs as &$j){$j['result']=json_decode($j['result_json']??'{}',true)?:[];unset($j['result_json'],$j['dispatch_token']);}unset($j);
        $leads=$admin?query('SELECT * FROM enquiries ORDER BY created_at DESC LIMIT 200')->fetchAll():[];
        json_response(['brands'=>$brands,'jobs'=>$jobs,'enquiries'=>$leads,'automation'=>automation_ready(),'user'=>$u]);
    }
    if($action==='brand' && $method==='POST') {
        $d=body();$bid=text_field($d,'id',32,false);$name=text_field($d,'name',120);$website=text_field($d,'website',500,false);
        if($website && (!filter_var($website,FILTER_VALIDATE_URL) || !in_array(parse_url($website,PHP_URL_SCHEME),['http','https'],true)))fail('Enter a complete website URL.');
        $fields=[$name,$website,text_field($d,'audience',3000,false),text_field($d,'tone',500,false),text_field($d,'description',5000,false),text_field($d,'palette',200,false),text_field($d,'services',200,false)];
        if($bid){brand_for_user($bid,$u);query('UPDATE brands SET name=?,website=?,audience=?,tone=?,description=?,palette=?,services=?,updated_at=? WHERE id=?',[...$fields,now(),$bid]);}
        else{$bid=id();query('INSERT INTO brands(name,website,audience,tone,description,palette,services,id,user_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[...$fields,$bid,$u['id'],now(),now()]);}
        json_response(['id'=>$bid]);
    }
    if($action==='job' && $method==='POST') {
        rate_limit('creative_requests',40);$d=body();$bid=text_field($d,'brand_id',32);$brand=brand_for_user($bid,$u);$type=text_field($d,'type',20);
        if(!in_array($type,['design','social','video','ads'],true))fail('Unknown service.');
        $jid=id();$status=automation_ready()?'queued':'awaiting_connection';
        query('INSERT INTO jobs(id,brand_id,user_id,type,title,brief,format,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[$jid,$bid,$brand['user_id'],$type,text_field($d,'title',160),text_field($d,'brief',10000),text_field($d,'format',100),$status,now(),now()]);
        event($jid,$status==='queued'?'Request queued for the connected creative workflow.':'Request saved. Prestige Inmedia will arrange production.');json_response(['id'=>$jid,'status'=>$status],201);
    }
    if($action==='job_update' && $method==='POST') {
        $d=body();$jid=text_field($d,'id',32);$j=query('SELECT * FROM jobs WHERE id=?',[$jid])->fetch();
        if(!$j || ($u['role']!=='admin' && $j['user_id']!==$u['id']))fail('Request not found.',404);
        $op=text_field($d,'operation',30);
        if($op==='approve') {if($j['status']!=='review')fail('This request is not ready to approve.',409);$status='approved';event($jid,'Client approved the creative output.');}
        elseif($op==='revision') {if(!in_array($j['status'],['review','approved'],true))fail('This request is not ready for a revision.',409);$note=text_field($d,'revision',4000);$status=automation_ready()?'queued':'awaiting_connection';query('UPDATE jobs SET revision=? WHERE id=?',[$note,$jid]);event($jid,'Revision requested: '.$note);}
        elseif($op==='retry' && $u['role']==='admin'){if(!in_array($j['status'],['failed','awaiting_connection'],true))fail('This request cannot be retried.',409);$status=automation_ready()?'queued':'awaiting_connection';event($jid,'Agency queued the request for production.');}
        elseif($op==='deliver' && $u['role']==='admin') {
            $result=['summary'=>text_field($d,'summary',6000),'canva_url'=>text_field($d,'canva_url',1000,false),'download_url'=>text_field($d,'download_url',1000,false)];
            foreach(['canva_url','download_url']as $key)if($result[$key]&&(!filter_var($result[$key],FILTER_VALIDATE_URL)||parse_url($result[$key],PHP_URL_SCHEME)!=='https'))fail('Deliverable URLs must use HTTPS.');
            query('UPDATE jobs SET result_json=? WHERE id=?',[json_encode($result,JSON_THROW_ON_ERROR),$jid]);$status='review';event($jid,'Agency delivered creative output for review.');
        }else fail('Unknown action or insufficient access.',403);
        query('UPDATE jobs SET status=?,updated_at=?,dispatch_token=NULL WHERE id=?',[$status,now(),$jid]);json_response(['ok'=>true]);
    }
    if($action==='enquiry_update' && $method==='POST'){require_user(true);$d=body();$status=text_field($d,'status',20);if(!in_array($status,['new','contacted','closed'],true))fail('Invalid status.');query('UPDATE enquiries SET status=? WHERE id=?',[$status,text_field($d,'id',32)]);json_response(['ok'=>true]);}
    if($action==='events' && $method==='GET') {$jid=$_GET['id']??'';$j=query('SELECT * FROM jobs WHERE id=?',[$jid])->fetch();if(!$j || ($u['role']!=='admin' && $j['user_id']!==$u['id']))fail('Request not found.',404);json_response(['events'=>query('SELECT * FROM job_events WHERE job_id=? ORDER BY created_at ASC,id ASC',[$jid])->fetchAll()]);}
    fail('Unknown endpoint.',404);
} catch(Throwable $e) {
    if(isset($GLOBALS['pdo']) && $GLOBALS['pdo']->inTransaction())$GLOBALS['pdo']->rollBack();
    error_log('Prestige API: '.$e->getMessage());
    $status=$e instanceof RuntimeException && $e->getCode()===503?503:500;
    json_response(['error'=>$status===503?'Website setup is not complete. Please contact Prestige Inmedia.':'We could not complete this request. Please try again.'], $status);
}
