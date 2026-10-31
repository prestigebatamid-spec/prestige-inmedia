<?php
declare(strict_types=1);
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/bootstrap.php';
if(($argv[1]??'')==='check'){
    foreach(['pdo','pdo_mysql','curl']as $ext)echo $ext.': '.(extension_loaded($ext)?'OK':'MISSING')."\n";
    try {config();db();echo 'Database: OK'."\n";echo 'Installed: '.(installed()?'yes':'no')."\n";echo 'Automation configured: '.(automation_ready()?'yes':'no')."\n";}catch(Throwable $e){echo "Configuration/database check failed. Review config.php.\n";exit(1);}exit;
}
if(($argv[1]??'')!=='reset-password'||empty($argv[2])){echo "Usage: php admin-cli.php check | reset-password EMAIL\n";exit(1);}
$u=query('SELECT id FROM users WHERE email=?',[strtolower($argv[2])])->fetch();if(!$u){echo "Account not found.\n";exit(1);}
if(!function_exists('shell_exec')){echo "Use an SSH terminal with hidden password input enabled.\n";exit(1);}
$mode=trim((string)shell_exec('stty -g'));
if(!$mode){echo "Run this command in an interactive SSH terminal.\n";exit(1);}
register_shutdown_function(static function()use($mode){shell_exec('stty '.escapeshellarg($mode));});
shell_exec('stty -echo');echo 'New password (12+ characters): ';$password=rtrim((string)fgets(STDIN),"\r\n");echo "\nConfirm password: ";$confirm=rtrim((string)fgets(STDIN),"\r\n");shell_exec('stty '.escapeshellarg($mode));echo "\n";
if(strlen($password)<12||strlen($password)>200||$password!==$confirm){echo "Password too short, too long or confirmation does not match.\n";exit(1);}
query('UPDATE users SET password_hash=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$u['id']]);echo "Password updated.\n";
