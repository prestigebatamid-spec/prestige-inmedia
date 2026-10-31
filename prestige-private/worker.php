<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__.'/bootstrap.php';
if (!installed()) { echo "Complete website setup first.\n"; exit(1); }
if (!automation_ready()) { echo "No automation connection configured. Requests remain saved for agency handling.\n"; exit; }
$lock=fopen(__DIR__.'/worker.lock','c');
if(!$lock || !flock($lock,LOCK_EX|LOCK_NB)){echo "Worker already running.\n";exit;}
// Reclaim interrupted deliveries only by marking failed: never silently duplicate paid generation.
$cutoff=gmdate('Y-m-d H:i:s',time()-1800);
query("UPDATE jobs SET status='failed',updated_at=? WHERE status='dispatching' AND updated_at<?",[now(),$cutoff]);
$a=config()['automation'];
$jobs=query("SELECT * FROM jobs WHERE status='queued' ORDER BY created_at ASC LIMIT 5")->fetchAll();
foreach($jobs as $j){
    $stamp=now();$dispatch=bin2hex(random_bytes(32));$claimed=query("UPDATE jobs SET status='dispatching',updated_at=?,dispatch_token=? WHERE id=? AND status='queued'",[$stamp,$dispatch,$j['id']]);
    if(!$claimed->rowCount())continue;
    $brand=query('SELECT * FROM brands WHERE id=?',[$j['brand_id']])->fetch();
    $payload=['schema_version'=>1,'job_id'=>$j['id'],'dispatch_token'=>$dispatch,'callback_url'=>rtrim(config()['app_url'],'/').'/api/index.php?action=callback','brand'=>$brand,'request'=>['type'=>$j['type'],'title'=>$j['title'],'brief'=>$j['brief'],'format'=>$j['format'],'revision'=>$j['revision']],'review_required'=>true];
    unset($payload['brand']['user_id']);
    $raw=json_encode($payload,JSON_THROW_ON_ERROR);$timestamp=(string)time();
    $ch=curl_init($a['webhook_url']);curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$raw,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>30,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-Prestige-Timestamp: '.$timestamp,'X-Prestige-Signature: sha256='.hash_hmac('sha256',$timestamp.'.'.$raw,$a['webhook_secret']),'Idempotency-Key: '.$payload['dispatch_token']]]);
    curl_exec($ch);$code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
    if($code>=200 && $code<300){query("UPDATE jobs SET status='processing' WHERE id=? AND status='dispatching'",[$j['id']]);event($j['id'],'Connected workflow accepted the request.');}
    else{query("UPDATE jobs SET status='failed',updated_at=? WHERE id=? AND status='dispatching'",[now(),$j['id']]);event($j['id'],'Workflow delivery failed. Agency review required before retrying.');}
    echo $j['id'].' HTTP '.$code."\n";
}
flock($lock,LOCK_UN);fclose($lock);
