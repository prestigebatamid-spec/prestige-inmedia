<?php
declare(strict_types=1);

function config(): array {
    static $config;
    if ($config !== null) return $config;
    $path = getenv('PRESTIGE_CONFIG') ?: __DIR__ . '/config.php';
    if (!is_file($path)) throw new RuntimeException('Website setup is not complete.', 503);
    $config = require $path;
    if (strlen($config['app_secret'] ?? '') < 32 || str_starts_with($config['app_secret'], 'CHANGE_')) {
        throw new RuntimeException('Configure a unique application secret.', 503);
    }
    return $config;
}

function db(): PDO {
    static $pdo;
    if ($pdo) return $pdo;
    $c = config()['db'];
    $pdo = new PDO($c['dsn'], $c['user'] ?? '', $c['password'] ?? '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') $pdo->exec('PRAGMA foreign_keys = ON');
    return $pdo;
}

function query(string $sql, array $params = []): PDOStatement {
    $q = db()->prepare($sql);
    $q->execute($params);
    return $q;
}
function id(): string { return bin2hex(random_bytes(16)); }
function now(): string { return gmdate('Y-m-d H:i:s'); }
function json_response(array $value, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($value, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    exit;
}
function fail(string $message, int $code = 400): never { json_response(['error' => $message], $code); }
function body(): array {
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if ($raw === false || strlen($raw) > 65536) fail('Request too large.', 413);
    try { $data = json_decode($raw ?: '{}', true, 64, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { fail('Invalid JSON.'); }
    if (!is_array($data)) fail('Expected a JSON object.');
    return $data;
}
function text_field(array $data, string $key, int $max, bool $required = true): string {
    $v = $data[$key] ?? '';
    if (!is_string($v)) fail('Invalid ' . $key . '.');
    $v = trim($v);
    if (($required && $v === '') || strlen($v) > $max) fail('Please check ' . $key . '.');
    return $v;
}
function valid_email(array $data): string {
    $email = strtolower(text_field($data, 'email', 190));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('Enter a valid email address.');
    return $email;
}
function public_user(array $u): array { return array_intersect_key($u, array_flip(['id','name','email','role'])); }
function current_user(): ?array {
    if (empty($_SESSION['user_id'])) return null;
    $u = query('SELECT id,name,email,role FROM users WHERE id=?', [$_SESSION['user_id']])->fetch();
    return $u ?: null;
}
function require_user(bool $admin = false): array {
    $u = current_user();
    if (!$u) fail('Please sign in to continue.', 401);
    if ($admin && $u['role'] !== 'admin') fail('Agency access required.', 403);
    return $u;
}
function csrf(): void {
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !hash_equals($_SESSION['csrf'] ?? '', $token)) fail('Refresh the page and try again.', 403);
}
function rate_limit(string $scope, int $max): void {
    $key = hash_hmac('sha256', $scope . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'local'), config()['app_secret']);
    $cutoff = gmdate('Y-m-d H:i:s', time() - 900);
    query('DELETE FROM rate_limits WHERE created_at < ?', [$cutoff]);
    $n = (int)query('SELECT COUNT(*) FROM rate_limits WHERE rate_key=?', [$key])->fetchColumn();
    if ($n >= $max) fail('Too many attempts. Please try again in 15 minutes.', 429);
    query('INSERT INTO rate_limits(id,rate_key,created_at) VALUES(?,?,?)', [id(),$key,now()]);
}
function brand_for_user(string $brandId, array $u): array {
    $b = $u['role'] === 'admin'
        ? query('SELECT * FROM brands WHERE id=?', [$brandId])->fetch()
        : query('SELECT * FROM brands WHERE id=? AND user_id=?', [$brandId,$u['id']])->fetch();
    if (!$b) fail('Brand not found.', 404);
    return $b;
}
function event(string $jobId, string $message): void {
    query('INSERT INTO job_events(id,job_id,message,created_at) VALUES(?,?,?,?)', [id(),$jobId,$message,now()]);
}
function installed(): bool {
    try { return (int)query("SELECT COUNT(*) FROM users WHERE role='admin'")->fetchColumn() > 0; }
    catch (PDOException $e) { return false; }
}
function schema(): void {
    $statements = [
        'CREATE TABLE IF NOT EXISTS users (id VARCHAR(32) PRIMARY KEY,name VARCHAR(120) NOT NULL,email VARCHAR(190) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,role VARCHAR(20) NOT NULL,created_at VARCHAR(19) NOT NULL)',
        'CREATE TABLE IF NOT EXISTS brands (id VARCHAR(32) PRIMARY KEY,user_id VARCHAR(32) NOT NULL,name VARCHAR(120) NOT NULL,website VARCHAR(500) NOT NULL,audience TEXT NOT NULL,tone VARCHAR(500) NOT NULL,description TEXT NOT NULL,palette VARCHAR(200) NOT NULL,services VARCHAR(200) NOT NULL,created_at VARCHAR(19) NOT NULL,updated_at VARCHAR(19) NOT NULL)',
        'CREATE TABLE IF NOT EXISTS jobs (id VARCHAR(32) PRIMARY KEY,brand_id VARCHAR(32) NOT NULL,user_id VARCHAR(32) NOT NULL,type VARCHAR(20) NOT NULL,title VARCHAR(160) NOT NULL,brief TEXT NOT NULL,format VARCHAR(100) NOT NULL,status VARCHAR(30) NOT NULL,result_json TEXT,revision TEXT,dispatch_token VARCHAR(64),created_at VARCHAR(19) NOT NULL,updated_at VARCHAR(19) NOT NULL)',
        'CREATE TABLE IF NOT EXISTS job_events (id VARCHAR(32) PRIMARY KEY,job_id VARCHAR(32) NOT NULL,message TEXT NOT NULL,created_at VARCHAR(19) NOT NULL)',
        'CREATE TABLE IF NOT EXISTS enquiries (id VARCHAR(32) PRIMARY KEY,name VARCHAR(120) NOT NULL,email VARCHAR(190) NOT NULL,company VARCHAR(160) NOT NULL,service VARCHAR(100) NOT NULL,message TEXT NOT NULL,status VARCHAR(20) NOT NULL,created_at VARCHAR(19) NOT NULL)',
        'CREATE TABLE IF NOT EXISTS rate_limits (id VARCHAR(32) PRIMARY KEY,rate_key VARCHAR(64) NOT NULL,created_at VARCHAR(19) NOT NULL)',
    ];
    foreach ($statements as $sql) db()->exec($sql);
}

function automation_ready(): bool {
    $a = config()['automation'] ?? [];
    return str_starts_with($a['webhook_url'] ?? '', 'https://') && strlen($a['webhook_secret'] ?? '') >= 32 && strlen($a['callback_secret'] ?? '') >= 32;
}
function callback_bearer(): void {
    $secret = config()['automation']['callback_secret'] ?? '';
    if (strlen($secret) < 32 || !hash_equals('Bearer ' . $secret, $_SERVER['HTTP_AUTHORIZATION'] ?? '')) fail('Unauthorized callback.', 401);
}
