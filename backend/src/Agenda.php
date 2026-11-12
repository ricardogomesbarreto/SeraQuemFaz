<?php
declare(strict_types=1);

/** Transactional agenda core. The HTTP layer must supply a verified session user, never a request-body user ID. */
function sqfAgenda(PDO $db, string $actor, string $request, string $action, ?string $start = null, ?int $duration = null): string {
    if (!in_array($action, ['propose','confirm','decline','cancel'], true)) throw new DomainException('Ação inválida');
    $db->beginTransaction();
    try {
        $run = static function(string $sql, array $args = []) use ($db): PDOStatement {
            $s = $db->prepare($sql); $s->execute($args); return $s;
        };
        $r = $run('SELECT * FROM sqf_service_requests WHERE id=? FOR UPDATE', [$request])->fetch(PDO::FETCH_ASSOC);
        if (!$r || !in_array($actor, [$r['client_id'], $r['provider_id']], true)) throw new DomainException('Solicitação indisponível');
        if (!in_array($r['status'], ['accepted','in_progress','awaiting_confirmation'], true)) throw new DomainException('Solicitação não permite agenda');
        // Every agenda writer locks the two identities in deterministic order.
        $ids = [$r['client_id'], $r['provider_id']]; sort($ids, SORT_STRING);
        foreach ($ids as $id) {
            if (!$run('SELECT id FROM sqf_auth_users WHERE id=? FOR UPDATE', [$id])->fetchColumn()) throw new DomainException('Participante indisponível');
        }
        $a = $run('SELECT * FROM sqf_appointments WHERE request_id=? FOR UPDATE', [$request])->fetch(PDO::FETCH_ASSOC);
        $utc = new DateTimeZone('UTC'); $now = new DateTimeImmutable('now', $utc);
        if ($action === 'propose') {
            if ($start === null || $duration === null || $duration < 30 || $duration > 480) throw new DomainException('Horário inválido');
            if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/D', $start)) throw new DomainException('Use horário ISO 8601 com fuso');
            $date = new DateTimeImmutable($start, $utc);
            if ($date <= $now->modify('+30 minutes') || $date > $now->modify('+180 days')) throw new DomainException('Horário inválido');
            $value = $date->setTimezone($utc)->format('Y-m-d H:i:s.u');
            if ($a && $a['status']==='confirmed') {
                $run('UPDATE sqf_appointments SET pending_starts_at=?,pending_duration_minutes=?,pending_proposed_by=?,updated_at=UTC_TIMESTAMP(6) WHERE id=?', [$value,$duration,$actor,$a['id']]);
                $result='reschedule_proposed';
            } elseif ($a) {
                $run("UPDATE sqf_appointments SET starts_at=?,duration_minutes=?,proposed_by=?,status='proposed',updated_at=UTC_TIMESTAMP(6) WHERE id=?", [$value,$duration,$actor,$a['id']]);
                $result='proposed';
            } else {
                $run('INSERT INTO sqf_appointments (request_id,client_id,provider_id,starts_at,duration_minutes,proposed_by) VALUES (?,?,?,?,?,?)', [$request,$r['client_id'],$r['provider_id'],$value,$duration,$actor]);
                $result='proposed';
            }
        } else {
            if (!$a || !in_array($a['status'], ['confirmed','proposed'],true)) throw new DomainException('Nenhuma agenda ativa');
            $pending = $a['status']==='confirmed' && $a['pending_starts_at']!==null;
            $proposer = $pending ? $a['pending_proposed_by'] : $a['proposed_by'];
            if ($action==='confirm') {
                if ((!$pending && $a['status']!=='proposed') || $proposer===$actor) throw new DomainException('Somente o destinatário confirma');
                $value=$pending ? $a['pending_starts_at'] : $a['starts_at'];
                $minutes=(int)($pending ? $a['pending_duration_minutes'] : $a['duration_minutes']);
                if (new DateTimeImmutable($value,$utc) <= $now) throw new DomainException('Proposta expirada');
                $end=(new DateTimeImmutable($value,$utc))->modify("+$minutes minutes")->format('Y-m-d H:i:s.u');
                $conflict=$run("SELECT id FROM sqf_appointments WHERE id<>? AND status='confirmed' AND (client_id IN (?,?) OR provider_id IN (?,?)) AND starts_at<? AND DATE_ADD(starts_at,INTERVAL duration_minutes MINUTE)>? LIMIT 1 FOR UPDATE", [$a['id'],$ids[0],$ids[1],$ids[0],$ids[1],$end,$value])->fetchColumn();
                if ($conflict) throw new DomainException('Horário indisponível');
                $run("UPDATE sqf_appointments SET starts_at=?,duration_minutes=?,proposed_by=?,status='confirmed',pending_starts_at=NULL,pending_duration_minutes=NULL,pending_proposed_by=NULL,updated_at=UTC_TIMESTAMP(6) WHERE id=?", [$value,$minutes,$proposer,$a['id']]); $result='confirmed';
            } elseif ($action==='decline') {
                if ((!$pending && $a['status']!=='proposed') || $proposer===$actor) throw new DomainException('Somente o destinatário recusa');
                $result=$pending ? 'confirmed' : 'declined';
                $run('UPDATE sqf_appointments SET status=?,pending_starts_at=NULL,pending_duration_minutes=NULL,pending_proposed_by=NULL,updated_at=UTC_TIMESTAMP(6) WHERE id=?', [$result,$a['id']]);
            } else {
                $run("UPDATE sqf_appointments SET status='canceled',pending_starts_at=NULL,pending_duration_minutes=NULL,pending_proposed_by=NULL,updated_at=UTC_TIMESTAMP(6) WHERE id=?", [$a['id']]); $result='canceled';
            }
        }
        $receiver=$actor===$r['client_id']?$r['provider_id']:$r['client_id'];
        $run('INSERT INTO sqf_notifications(recipient_id,kind,title,body,request_id) VALUES (?,?,?,?,?)',[$receiver,'appointment','Agenda atualizada','Confira o horário e a situação do atendimento.',$request]);
        $db->commit(); return $result;
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}
