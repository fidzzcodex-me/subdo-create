<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function json_error($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'errors' => [['message' => $msg]]]);
    exit;
}

$zone = $_POST['zone'] ?? '';
$token = $_POST['token'] ?? '';
$sd = $_POST['subdomain'] ?? '';
$ip = $_POST['ip'] ?? '';
$proxied = $_POST['proxied'] === 'true';

if (!$zone || !$token || !$sd || !$ip) {
    json_error('Zone ID, Token, Subdomain, IP wajib diisi');
}

// Step 1: Get domain from Zone ID
$ch = curl_init("https://api.cloudflare.com/client/v4/zones/" . urlencode($zone));
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ["Authorization: Bearer {$token}", "Content-Type: application/json"],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_FOLLOWLOCATION => true
]);
$res = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);

if (curl_errno($ch)) {
    json_error('Curl error: ' . curl_error($ch), 500);
}
curl_close($ch);

if ($http_code !== 200) {
    json_error("Zone ID tidak valid atau Token salah. HTTP: {$http_code}", $http_code);
}

$data = json_decode($res, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    json_error('Response Cloudflare bukan JSON valid', 500);
}
if (!$data['success']) {
    echo $res; // langsung forward error dari CF biar jelas
    exit;
}

$domain = $data['result']['name'];
$fullName = $sd . '.' . $domain;

// Step 2: Create DNS record
$payload = json_encode([
    'type' => 'A',
    'name' => $fullName,
    'content' => $ip,
    'ttl' => 120,
    'proxied' => $proxied
]);

$ch2 = curl_init("https://api.cloudflare.com/client/v4/zones/" . urlencode($zone) . "/dns_records");
curl_setopt_array($ch2, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer {$token}", "Content-Type: application/json"],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 15,
    CURLOPT_FOLLOWLOCATION => true
]);
$res2 = curl_exec($ch2);
$http_code2 = curl_getinfo($ch2, CURLINFO_HTTP_CODE);

if (curl_errno($ch2)) {
    json_error('Curl error step 2: ' . curl_error($ch2), 500);
}
curl_close($ch2);

// Forward response Cloudflare mentah-mentah biar errornya keliatan
http_response_code($http_code2);
echo $res2;
