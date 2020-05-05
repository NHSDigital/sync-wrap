import json
import json
import os
import shutil
import subprocess
from functools import wraps
from tempfile import TemporaryDirectory

import boto3
import botocore
import requests
import requests_mock

from lambdas.package_lambda import package_lambda
from shared import project_dir

CONFIG = botocore.config.Config(retries={'max_attempts': 0})


def get_lambda_client():
    return boto3.client(
        'lambda',
        aws_access_key_id='',
        aws_secret_access_key='',
        region_name='eu-west-2',
        endpoint_url='http://localhost:4574',
        config=CONFIG
    )


def zip_lambda_content(function_name: str, src: str):

    with TemporaryDirectory() as d:

        package_lambda(
            function=function_name,
            src=src,
            dest_dir=d
        )

        with TemporaryDirectory() as out_dir:

            zipfile = os.path.join(out_dir, 'lambda')

            shutil.make_archive(zipfile, 'zip', d)

            with open(f"{zipfile}.zip", 'rb') as zf:
                return zf.read()


def create_lambda(function_name: str, src: str = None):
    lambda_client = get_lambda_client()

    zipped_code = zip_lambda_content(function_name, src)
    lambda_client.create_function(
        FunctionName=function_name,
        Runtime='python3.7',
        Role='role',
        Handler=f'{function_name}.handler',
        Code=dict(ZipFile=zipped_code)
    )


def delete_lambda(function_name):
    lambda_client = get_lambda_client()
    lambda_client.delete_function(
        FunctionName=function_name
    )


def apigateway_event(updates: dict = None, method='GET', proxy_path="test", root_path="echo") -> dict:

    result = {
        "path": f"/{root_path}/{proxy_path}",
        "headers": {
            "Host": "localhost:4567",
            "Connection": "keep-alive",
            "Content-Length": "4",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
            "Sec-Fetch-Dest": "document",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-User": "?1",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-GB,en-US;q=0.9,en;q=0.8",
            "Cookie": "csrf-token=",
            "X-Forwarded-For": "192.168.100.1, 0.0.0.0:4567"
        },
        "pathParameters": {"proxy+": f"{proxy_path}"},
        "body": "test",
        "isBase64Encoded": False,
        "resource": f"/restapis/1234sdfsdfsdf/local/_user_request_/{root_path}/{proxy_path}",
        "httpMethod": method,
        "queryStringParameters": {},
        "requestContext": {
            "path": f"/{root_path}/{proxy_path}",
            "accountId": "000000000000",
            "resourceId": "4kcri18ja3",
            "stage": "local",
            "identity": {
                "accountId": "000000000000",
                "sourceIp": "192.168.100.1",
                "userAgent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36"
            }
        },
        "stageVariables": {}
    }

    if updates:
        result.update(updates)

    return result


def invoke_function_and_get_message(function_name, payload={}):
    lambda_client = get_lambda_client()
    response = lambda_client.invoke(
        FunctionName=function_name,
        InvocationType='RequestResponse',
        Payload=json.dumps(payload).encode()
    )
    return json.loads(
        response['Payload']
            .read()
            .decode('utf-8')
    )


class WithNamedLambda:

    def __init__(self, lambda_function: str):
        self._lambda_function = lambda_function

    def __call__(self, f):
        @wraps(f)
        def wrapper(*args, **kwds):
            create_lambda(self._lambda_function)
            try:
                return f(*args, **kwds)
            finally:
                delete_lambda(self._lambda_function)

        return wrapper


class WithRequestsMockAny:

    def __init__(self, default_response: str = 'data'):
        self._default_response = default_response

    def __call__(self, f):
        @wraps(f)
        def wrapper(*args, **kwds):

            with requests_mock.Mocker() as m:
                m.register_uri(method=requests_mock.ANY, url=requests_mock.ANY, text=self._default_response)
                return f(*args, **kwds)

        return wrapper