"""Run with PHP_CGI pointing to php-cgi; requires PDO SQLite for isolated tests."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Session:
    def __init__(self, suite, ip):
        self.suite, self.ip, self.cookie, self.csrf = suite, ip, '', ''
        _, data = self.call('bootstrap')
        self.csrf = data['csrf']

    def call(self, action, data=None, params='', bearer='', csrf=None):
        raw = json.dumps(data).encode() if data is not None else b''
        env = {**os.environ, 'REDIRECT_STATUS': '200', 'REQUEST_METHOD': 'POST' if data is not None else 'GET',
               'SCRIPT_FILENAME': str(ROOT / 'public_html/api/index.php'), 'SCRIPT_NAME': '/api/index.php',
               'QUERY_STRING': 'action=' + action + params, 'CONTENT_TYPE': 'application/json',
               'CONTENT_LENGTH': str(len(raw)), 'HTTP_COOKIE': self.cookie,
               'REMOTE_ADDR': self.ip, 'SERVER_NAME': 'localhost', 'SERVER_PROTOCOL': 'HTTP/1.1',
               'HTTP_X_CSRF_TOKEN': self.csrf if csrf is None else csrf, 'PRESTIGE_CONFIG': str(self.suite.config)}
        if bearer:
            env['HTTP_AUTHORIZATION'] = 'Bearer ' + bearer
        cmd = [os.environ.get('PHP_CGI', 'php-cgi'), '-n']
        ext = os.environ.get('PHP_EXTENSION_DIR')
        if ext:
            cmd += ['-d', 'extension_dir=' + ext]
        cmd += ['-d', 'extension=pdo.so', '-d', 'extension=pdo_sqlite.so',
                '-d', 'session.save_path=' + str(self.suite.path / 'sessions')]
        p = subprocess.run(cmd, input=raw, env=env, capture_output=True)
        output = p.stdout.decode()
        self.suite.assertIn('\r\n\r\n', output, output + p.stderr.decode())
        header, body = output.split('\r\n\r\n', 1)
        status = 200
        for line in header.split('\r\n'):
            if line.lower().startswith('set-cookie: prestige_session='):
                self.cookie = line.split(': ', 1)[1].split(';', 1)[0]
            if line.startswith('Status: '):
                status = int(line.split()[1])
        try:
            parsed = json.loads(body)
        except Exception:
            raise AssertionError(body + p.stderr.decode())
        if 'csrf' in parsed:
            self.csrf = parsed['csrf']
        return status, parsed


class ApiRegression(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name)
        (self.path / 'sessions').mkdir()
        self.config = self.path / 'config.php'
        self.token = secrets.token_hex(32)
        self.secret = secrets.token_hex(32)
        self.callback_secret = secrets.token_hex(32)
        self.write_config()

    def write_config(self, connected=False):
        a = "['webhook_url'=>'https://automation.example.test/ingest','webhook_secret'=>'" + self.secret + "','callback_secret'=>'" + self.callback_secret + "']" if connected else '[]'
        self.config.write_text("<?php return ['app_url'=>'https://agency.example','app_secret'=>'" + self.secret + "','setup_token'=>'" + self.token + "','db'=>['dsn'=>'sqlite:" + str(self.path / 'test.sqlite') + "'],'automation'=>" + a + "];")

    def tearDown(self):
        self.tmp.cleanup()

    def test_full_client_agency_flow(self):
        owner = Session(self, '127.0.0.1')
        self.assertFalse(owner.call('bootstrap')[1]['installed'])
        data = {'token': 'incorrect', 'name': 'Agency', 'email': 'owner@example.test', 'password': 'Owner-test-pass-123'}
        self.assertEqual(owner.call('setup', data)[0], 403)
        data['token'] = self.token
        self.assertEqual(owner.call('setup', data)[0], 201)
        self.assertEqual(owner.call('setup', data)[0], 409)
        self.assertEqual(owner.call('bootstrap')[1]['user']['role'], 'admin')
        client = Session(self, '127.0.0.2')
        _, result = client.call('register', {'name': 'Client A', 'email': 'a@example.test', 'password': 'Client-test-pass-123', 'role': 'admin'})
        self.assertEqual(result['user']['role'], 'client')
        self.assertEqual(client.call('brand', {'name': 'Brand A'}, csrf='wrong')[0], 403)
        status, result = client.call('brand', {'name': 'Brand A', 'website': 'https://example.com', 'description': '<script>test</script>'})
        self.assertEqual(status, 200)
        bid = result['id']
        other = Session(self, '127.0.0.3')
        other.call('register', {'name': 'Client B', 'email': 'b@example.test', 'password': 'Client-test-pass-456'})
        self.assertEqual(other.call('brand', {'id': bid, 'name': 'Stolen brand'})[0], 404)
        self.assertEqual(other.call('workspace')[1]['brands'], [])
        request = {'brand_id': bid, 'type': 'design', 'title': 'Campaign', 'brief': 'A real test brief', 'format': '4:5'}
        self.assertEqual(other.call('job', request)[0], 404)
        status, result = client.call('job', request)
        self.assertEqual(status, 201)
        self.assertEqual(result['status'], 'awaiting_connection')
        jid = result['id']
        self.assertEqual(other.call('events', params='&id=' + jid)[0], 404)
        self.assertEqual(other.call('job_update', {'id': jid, 'operation': 'deliver'})[0], 404)
        self.assertEqual(client.call('job_update', {'id': jid, 'operation': 'deliver'})[0], 403)
        self.assertEqual(owner.call('job_update', {'id': jid, 'operation': 'deliver', 'summary': 'Ready', 'canva_url': 'javascript:alert(1)'})[0], 400)
        self.assertEqual(owner.call('job_update', {'id': jid, 'operation': 'deliver', 'summary': 'Ready', 'canva_url': 'https://www.canva.com/design/example/edit'})[0], 200)
        self.assertEqual(client.call('workspace')[1]['jobs'][0]['status'], 'review')
        self.assertEqual(client.call('job_update', {'id': jid, 'operation': 'approve'})[0], 200)
        self.assertEqual(client.call('job_update', {'id': jid, 'operation': 'approve'})[0], 409)
        self.assertEqual(client.call('job_update', {'id': jid, 'operation': 'revision', 'revision': 'Use a brighter background'})[0], 200)
        self.assertEqual(client.call('workspace')[1]['jobs'][0]['status'], 'awaiting_connection')
        self.assertGreaterEqual(len(client.call('events', params='&id=' + jid)[1]['events']), 4)
        lead = {'name': 'Enquiry', 'email': 'lead@example.test', 'company': 'A company', 'service': 'Graphic design', 'message': 'Please quote.'}
        self.assertEqual(other.call('enquiry', lead)[0], 201)
        self.assertEqual(len(owner.call('workspace')[1]['enquiries']), 1)
        self.assertEqual(other.call('workspace')[1]['enquiries'], [])
        self.assertEqual(other.call('enquiry_update', {'id': 'fake', 'status': 'closed'})[0], 403)
        self.assertEqual(client.call('callback', {'job_id': jid, 'status': 'review'})[0], 401)
        # Agency requests against a client brand retain client ownership.
        _, agency_job = owner.call('job', {**request, 'title': 'Agency-created'})
        self.assertIn(agency_job['id'], [j['id'] for j in client.call('workspace')[1]['jobs']])
        # A connected workflow uses dispatch tokens and rejects stale callbacks.
        self.write_config(True)
        _, queued = client.call('job', {**request, 'title': 'Connected job'})
        self.assertEqual(queued['status'], 'queued')
        qid = queued['id']
        stamp = '2026-10-31 00:00:00'
        dispatch = secrets.token_hex(32)
        with sqlite3.connect(self.path / 'test.sqlite') as con:
            con.execute("UPDATE jobs SET status='processing',updated_at=?,dispatch_token=? WHERE id=?", (stamp, dispatch, qid))
        callback = {'job_id': qid, 'status': 'review', 'dispatch_token': 'stale', 'result': {'summary': 'Generated creative'}}
        self.assertEqual(client.call('callback', callback, bearer=self.callback_secret)[0], 409)
        callback['dispatch_token'] = dispatch
        self.assertEqual(client.call('callback', callback, bearer=self.callback_secret)[0], 200)
        client.call('job_update', {'id': qid, 'operation': 'approve'})
        self.assertTrue(client.call('callback', callback, bearer=self.callback_secret)[1]['ignored'])
        client.call('logout', {})
        self.assertEqual(client.call('workspace')[0], 401)
        self.assertEqual(client.call('login', {'email': 'a@example.test', 'password': 'bad'})[0], 401)
        self.assertEqual(client.call('login', {'email': 'a@example.test', 'password': 'Client-test-pass-123'})[0], 200)
        print('Passed: setup, auth, CSRF, ownership, enquiries, delivery, revisions, approval and callback replay protection.')


if __name__ == '__main__':
    unittest.main()
