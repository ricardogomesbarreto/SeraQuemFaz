<?php
declare(strict_types=1);
// Copy as public_html/api/index.php in the documented staging layout.
// The private application source and credentials must never be served directly.
$private=dirname(__DIR__,2).'/sqf-private';
require $private.'/config.php';
require $private.'/backend/public/index.php';
