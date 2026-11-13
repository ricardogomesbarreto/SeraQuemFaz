<?php
declare(strict_types=1);
require_once __DIR__.'/Auth.php';
require_once __DIR__.'/StaffSecrets.php';
require_once __DIR__.'/Moderation.php';

/**
 * Owner-authorized, first-time initialization only. NEVER expose this in an HTTP route.
 * SSH server ownership is the out-of-band authority for creating the FIRST administrator.
 */
function sqfBootstrapFirstAdmin(PDO $db,string $email,string $password,string $name,string $secretHex):string {
    if(PHP_SAPI!=='cli')throw new DomainException('Operação limitada ao servidor');
    $email=sqfEmail($email);
    $name=trim($name);
    if(mb_strlen($name)<2||mb_strlen($name)>120||!preg_match('/^[a-f0-9]{40}$/iD',$secretHex))throw new DomainException('Dados administrativos inválidos');
    $hash=sqfPassword($password);
    $lock=(int)sqfQuery($db,"SELECT GET_LOCK('sqf_bootstrap_admin_v1',10)")->fetchColumn();
    if($lock!==1)throw new RuntimeException('Não foi possível obter bloqueio administrativo');
    try{
      // Never overwrite or impersonate an existing identity.
      if((int)sqfQuery($db,"SELECT COUNT(*) FROM sqf_admin_members WHERE role='admin'")->fetchColumn()!==0)
         throw new DomainException('O sistema já possui administrador; recuperação exige fluxo separado');
      if(sqfQuery($db,'SELECT 1 FROM sqf_auth_users WHERE email=?',[$email])->fetchColumn())
         throw new DomainException('Este e-mail já possui conta; use outro endereço sob seu controle');
      $id=(string)$db->query('SELECT UUID()')->fetchColumn();
      $db->beginTransaction();
      try{
        // ONLY server-owner bootstrap can attest ownership out-of-band when SMTP is offline.
        // Ordinary self-registration always requires email delivery/confirmation.
        sqfQuery($db,'INSERT INTO sqf_auth_users(id,email,password_hash,email_confirmed_at) VALUES (?,?,?,UTC_TIMESTAMP(6))',[$id,$email,$hash]);
        sqfQuery($db,"INSERT INTO profiles(id,full_name,account_type) VALUES (?,?,'cliente')",[$id,$name]);
        sqfQuery($db,"INSERT INTO sqf_admin_members(user_id,role,active) VALUES (?,'admin',1)",[$id]);
        sqfStaffMfaProvision($id,$secretHex);
        $db->commit();
      }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
      error_log('SQF: first administrator initialized through server CLI; mailbox ownership not validated by SMTP');
      return $id;
    } finally {sqfQuery($db,"SELECT RELEASE_LOCK('sqf_bootstrap_admin_v1')");}
}
