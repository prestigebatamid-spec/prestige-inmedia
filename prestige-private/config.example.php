<?php
// Copy to config.php in this private directory, beside public_html (not inside it).
return [
    'app_url' => 'https://your-domain.com',
    'app_secret' => 'CHANGE_TO_A_RANDOM_STRING_OF_AT_LEAST_32_CHARACTERS',
    'setup_token' => 'CHANGE_TO_A_DIFFERENT_RANDOM_STRING_OF_AT_LEAST_32_CHARACTERS',
    'db' => [
        'dsn' => 'mysql:host=localhost;dbname=YOUR_DATABASE;charset=utf8mb4',
        'user' => 'YOUR_DATABASE_USER',
        'password' => 'YOUR_DATABASE_PASSWORD',
    ],
    // The receiving workflow runs Claude research and Canva creation.
    // Leave blank until connected. API keys belong in that workflow, not in the browser.
    'automation' => [
        'webhook_url' => '',
        'webhook_secret' => '',
        'callback_secret' => '',
    ],
];
