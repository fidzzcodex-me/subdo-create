<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$zone = $_POST['zone']?? '';
$token = $_POST['token']?? '';
$sd = $_POST['subdomain']?? '';
$ip = $_POST['ip']?? '';
$proxied = $_POST['proxied'] === 'true';

if (!$zone ||!$token ||!$sd ||!$ip) {
    http_response_code(400);
    echo json_encode(['success' => false, 'errors' => [['message' => 'Missing required fields']]]);
    exit;
}

// Get domain name from Zone ID
$ch = curl_init("https://api.cloudflare.com/client/v4/zones/{$zone}");
curl_setopt_array($ch, [
    CURLOPT_HTTPHEADER => ["Authorization: Bearer {$token}", "Content-Type: application/json"],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true
]);
$res = curl_exec($ch);

if (curl_errno($ch)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'errors' => [['message' => 'Curl error: '. curl_error($ch)]]]);
    exit;
}
curl_close($ch);

$data = json_decode($res, true);
if (!$data['success']) {
    http_response_code(400);
    echo json_encode($data);
    exit;
}

$domain = $data['result']['name'];
$fullName = $sd. '.'. $domain;

// Create DNS record
$payload = json_encode([
    'type' => 'A',
    'name' => $fullName,
    'content' => $ip,
    'ttl' => 120,
    'proxied' => $proxied
]);

$ch2 = curl_init("https://api.cloudflare.com/client/v4/zones/{$zone}/dns_records");
curl_setopt_array($ch2, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ["Authorization: Bearer {$token}", "Content-Type: application/json"],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true
]);
$res2 = curl_exec($ch2);
curl_close($ch2);

echo $res2;
