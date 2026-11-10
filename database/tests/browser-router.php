<?php
declare(strict_types=1);
// CI-only router. The document root is a temporary copy of public HTML/assets.
// Never deploy this router or test fixtures to production.
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if(in_array($path,['/index.php','/api/index.php'],true)){require __DIR__.'/../../backend/public/index.php';return true;}
if($path==='/'||preg_match('~^/[a-zA-Z0-9_-]+[.]html$~D',$path)||str_starts_with($path,'/assets/'))return false;
http_response_code(404);return true;
