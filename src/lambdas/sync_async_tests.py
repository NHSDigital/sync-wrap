import base64
import json
import time
from typing import Generator
from uuid import uuid4

import pytest
import requests_mock

from lambdas.helpers import apigateway_event
from lambdas.sync_async import handler


@pytest.fixture(scope='function')
def default_env(temp_env) -> Generator[dict, None, None]:

    temp_env['upstream'] = 'https://fake.com/base/path'
    temp_env['allow_insecure'] = "false"

    yield temp_env

def test_lambda_bad_event_returns_bad_request(default_env):

    with requests_mock.Mocker() as m:
        m.register_uri(method=requests_mock.ANY, url=requests_mock.ANY, text='test')
        resp = handler({}, None)

    assert not m.called
    assert resp['status'] == 400
    assert resp['statusDescription'] == 'Bad Request'
    assert resp['body']
    body = json.loads(resp['body'])
    assert len(body['errors']) == 1
    assert body['errors'][0]['type'] == 'KeyError'
    assert body['errors'][0]['msg'] == "'pathParameters'"


def test_lambda_invalid_syncWait_returns_bad_request(default_env):

    with requests_mock.Mocker() as m:
        event = apigateway_event()
        event['queryStringParameters']['syncWait'] = 'bob'
        m.register_uri(method=requests_mock.ANY, url=requests_mock.ANY, text='test')
        resp = handler(event, None)

    assert not m.called
    assert resp['status'] == 400
    assert resp['statusDescription'] == 'Bad Request'
    assert resp['body']
    body = json.loads(resp['body'])
    assert len(body['errors']) == 1
    assert body['errors'][0]['type'] == 'ValueError'
    assert body['errors'][0]['msg'] == "invalid literal for int() with base 10: 'bob'"


def test_lambda_removes_and_adds_xforwarded_for(default_env):

    source_ip = uuid4().hex
    with requests_mock.Mocker() as m:
        m.register_uri(method=requests_mock.ANY, url=requests_mock.ANY, text='test')
        event = apigateway_event()
        event['requestContext']['identity']['sourceIp'] = source_ip
        handler(event, None)

    assert m.called
    assert m.request_history[0]._request.headers['X-Forwarded-For']


def text_response(request, context, status: int = 200, response: str = 'static', sleep_for: int = 1):
    context.status_code = status
    time.sleep(sleep_for)
    return response


def test_get_a_real_url(temp_env):

    temp_env['upstream'] = 'https://localhost:9003'
    temp_env['allow_insecure'] = "true"

    resp = handler(
        apigateway_event(
            dict(
                queryStringParameters=dict(syncWait=10),
                pathParameters={"proxy+": "ping"}
            )
        ),
        None
    )

    assert resp
    assert resp['isBase64Encoded'] is True
    assert resp['body'] == base64.b64encode(b'{"version": "0+0.abcdef1"}').decode()
