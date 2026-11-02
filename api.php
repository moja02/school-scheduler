<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$baseDir = __DIR__;
$dataDir = $baseDir . DIRECTORY_SEPARATOR . 'data';
$dataFile = $dataDir . DIRECTORY_SEPARATOR . 'data.json';
$schedulerDir = $baseDir . DIRECTORY_SEPARATOR . 'scheduler';

// تحديد مسار البايثون تلقائياً
$pythonCandidates = [
    'C:\\Users\\HP\\AppData\\Local\\Programs\\Python\\Python312\\python.exe',
    'python'
];
$pythonBin = 'python';
foreach ($pythonCandidates as $cand) {
    if (file_exists($cand) || $cand === 'python') {
        $pythonBin = $cand;
        break;
    }
}

// مسار السكربت المنفذ للخوارزمية
$cliSolver = $baseDir . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . 'core' . DIRECTORY_SEPARATOR . 'cli_solver.py';

// استخراج المسار المطلوب
$uri = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($uri, PHP_URL_PATH);

// إزالة مسار المجلد الأساسي لتحديد المسار المطلوب بدقة
$subpaths = explode('/api/', $path);
$action = isset($subpaths[1]) ? trim($subpaths[1], '/') : '';

if (!$action && isset($_GET['action'])) {
    $action = trim($_GET['action'], '/');
}

// ==========================================
// 1. توليد الجدول (Generate Schedule)
// ==========================================
if ($action === 'generate') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $rawInput = file_get_contents('php://input');
    
    // إذا لم ترسل الواجهة بيانات، نستخدم data.json المحفوظ
    if (empty(trim($rawInput)) || trim($rawInput) === '{}') {
        if (file_exists($dataFile)) {
            $rawInput = file_get_contents($dataFile);
        }
    }

    $descriptors = [
        0 => ["pipe", "r"], // stdin
        1 => ["pipe", "w"], // stdout
        2 => ["pipe", "w"]  // stderr
    ];

    $cmd = '"' . $pythonBin . '" "' . $cliSolver . '"';
    $process = proc_open($cmd, $descriptors, $pipes, $baseDir);

    if (is_resource($process)) {
        fwrite($pipes[0], $rawInput);
        fclose($pipes[0]);

        $output = stream_get_contents($pipes[1]);
        fclose($pipes[1]);

        $error = stream_get_contents($pipes[2]);
        fclose($pipes[2]);

        proc_close($process);

        $result = json_decode($output, true);
        if ($result && !isset($result['error'])) {
            if (!is_dir($schedulerDir)) {
                mkdir($schedulerDir, 0777, true);
            }
            $timestamp = date('Y-m-d_H-i-s');
            $filename = "schedule_{$timestamp}.json";
            file_put_contents($schedulerDir . DIRECTORY_SEPARATOR . $filename, json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
            $result['filename'] = $filename;
            echo json_encode($result, JSON_UNESCAPED_UNICODE);
        } else {
            if ($result) {
                echo json_encode($result, JSON_UNESCAPED_UNICODE);
            } else {
                echo json_encode(['error' => 'فشل التوليد: ' . ($error ?: 'خطأ غير معروف')], JSON_UNESCAPED_UNICODE);
            }
        }
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'تعذر تشغيل محرك الجدولة الذكي'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// ==========================================
// 2. تحميل وحفظ البيانات (Data)
// ==========================================
if ($action === 'data') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $rawInput = file_get_contents('php://input');
        if (!is_dir($dataDir)) {
            mkdir($dataDir, 0777, true);
        }
        file_put_contents($dataFile, $rawInput);
        echo json_encode(['status' => 'success'], JSON_UNESCAPED_UNICODE);
        exit;
    } else {
        if (file_exists($dataFile)) {
            echo file_get_contents($dataFile);
        } else {
            echo json_encode([
                "school_structure" => [
                    "primary" => [],
                    "preparatory" => [],
                    "secondary" => []
                ],
                "grades" => [],
                "teachers" => [],
                "requirements" => []
            ], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
}

// ==========================================
// 3. قائمة الجداول المحفوظة (Schedules List)
// ==========================================
if ($action === 'schedules') {
    if (!is_dir($schedulerDir)) {
        echo json_encode([]);
        exit;
    }
    $files = scandir($schedulerDir, SCANDIR_SORT_DESCENDING);
    $result = [];
    foreach ($files as $f) {
        if (str_ends_with($f, '.json')) {
            $result[] = $f;
        }
    }
    echo json_encode($result, JSON_UNESCAPED_UNICODE);
    exit;
}

// ==========================================
// 4. تحميل جدول محدد من السجل
// ==========================================
if (str_starts_with($action, 'schedules/')) {
    $filename = basename(substr($action, strlen('schedules/')));
    $filepath = $schedulerDir . DIRECTORY_SEPARATOR . $filename;
    if (file_exists($filepath)) {
        echo file_get_contents($filepath);
    } else {
        http_response_code(404);
        echo json_encode(['error' => 'الملف غير موجود'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// في حال مسار غير معروف
http_response_code(404);
echo json_encode(['error' => 'Endpoint not found', 'action' => $action], JSON_UNESCAPED_UNICODE);
